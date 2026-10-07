/**
 * RETHA Admin Panel — Property Image & Media Manager
 * Handles multi-image upload to Supabase Storage bucket 'property-images',
 * thumbnail previews, reordering (display_order), and image deletion.
 */
import { adminApi } from './api.js';
import { adminToast } from './toast.js';

export class AdminImageManager {
  constructor(propertyId, container) {
    this.propertyId = propertyId;
    this.container = container;
    this.images = [];
    this.selectedFiles = [];
    this.isUploading = false;
  }

  async init() {
    await this.loadImages();
    this.render();
  }

  async loadImages() {
    try {
      this.images = await adminApi.getPropertyImages(this.propertyId);
    } catch (err) {
      console.error('Failed to load property images:', err);
      adminToast.error('Failed to load images from database.');
      this.images = [];
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="admin-media-manager">
        <div class="media-manager-header">
          <div>
            <h3 class="admin-section-title">Property Media & Gallery</h3>
            <p class="admin-section-desc">
              Upload exterior and interior photos to the <code>property-images</code> storage bucket.
              Drag or use controls to adjust display ordering.
            </p>
          </div>
          <span class="media-count-badge">${this.images.length} Image${this.images.length === 1 ? '' : 's'}</span>
        </div>

        <!-- UPLOAD SECTION -->
        <div class="media-upload-card">
          <div class="upload-controls-row">
            <div class="form-group-inline">
              <label for="upload-image-type">Category / Type:</label>
              <select id="upload-image-type" class="admin-select admin-select-sm">
                <option value="exterior">Exterior (واجهة خارجية)</option>
                <option value="interior">Interior (تفاصيل داخلية)</option>
              </select>
            </div>
          </div>

          <div id="media-dropzone" class="media-dropzone">
            <input
              type="file"
              id="media-file-input"
              accept="image/jpeg,image/png,image/webp,image/jpg"
              multiple
              class="dropzone-input"
            />
            <div class="dropzone-content">
              <span class="dropzone-icon">📷</span>
              <p class="dropzone-text">
                <strong>Click to browse</strong> or drag & drop property photos here
              </p>
              <span class="dropzone-hint">Supports JPEG, PNG, WEBP (Max 5MB per image)</span>
            </div>
          </div>

          <!-- Staged files preview before upload -->
          <div id="staged-files-list" class="staged-files-list" style="display: none;">
            <div class="staged-header">
              <span id="staged-count-label">0 files selected</span>
              <button type="button" id="btn-clear-staged" class="admin-btn-link text-danger">Clear</button>
            </div>
            <div id="staged-previews-grid" class="staged-previews-grid"></div>
            <button type="button" id="btn-start-upload" class="admin-btn admin-btn-primary admin-btn-sm mt-3">
              <span>Upload to Storage</span>
            </button>
          </div>
        </div>

        <!-- CURRENT IMAGES GALLERY -->
        <div class="media-gallery-section">
          <h4 class="media-subheading">Current Gallery Photos (${this.images.length})</h4>

          ${
            this.images.length === 0
              ? `
            <div class="admin-empty-state">
              <span class="empty-icon">🖼️</span>
              <p>No photos uploaded for this property yet.</p>
              <span class="empty-hint">Use the upload box above to add high-resolution exterior and interior photos.</span>
            </div>
          `
              : `
            <div class="media-items-grid" id="media-items-grid">
              ${this.images
                .map(
                  (img, index) => `
                <div class="media-card" data-id="${img.id}" data-order="${img.display_order ?? index}">
                  <div class="media-card-thumb">
                    <img src="${img.image_url}" alt="${this.escapeHtml(img.title || 'Property photo')}" loading="lazy" />
                    <span class="media-type-tag ${img.image_type === 'interior' ? 'tag-interior' : 'tag-exterior'}">
                      ${img.image_type || 'exterior'}
                    </span>
                    <span class="media-order-badge">#${img.display_order ?? index + 1}</span>
                  </div>
                  <div class="media-card-body">
                    <div class="media-card-info">
                      <span class="media-filename" title="${this.escapeHtml(img.title || '')}">
                        ${this.escapeHtml(img.title || 'Untitled Image')}
                      </span>
                    </div>
                    <div class="media-card-actions">
                      <div class="order-btn-group">
                        <button
                          type="button"
                          class="btn-order-move btn-move-up"
                          data-id="${img.id}"
                          data-index="${index}"
                          ${index === 0 ? 'disabled' : ''}
                          title="Move Earlier"
                        >▲</button>
                        <button
                          type="button"
                          class="btn-order-move btn-move-down"
                          data-id="${img.id}"
                          data-index="${index}"
                          ${index === this.images.length - 1 ? 'disabled' : ''}
                          title="Move Later"
                        >▼</button>
                      </div>
                      <button
                        type="button"
                        class="admin-btn admin-btn-danger admin-btn-xs btn-delete-image"
                        data-id="${img.id}"
                        data-url="${encodeURIComponent(img.image_url)}"
                        title="Delete photo"
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </div>
                </div>
              `
                )
                .join('')}
            </div>
          `
          }
        </div>
      </div>
    `;

    this.bindEvents();
  }

  bindEvents() {
    const fileInput = this.container.querySelector('#media-file-input');
    const dropzone = this.container.querySelector('#media-dropzone');
    const stagedList = this.container.querySelector('#staged-files-list');
    const stagedPreviews = this.container.querySelector('#staged-previews-grid');
    const stagedCountLabel = this.container.querySelector('#staged-count-label');
    const uploadBtn = this.container.querySelector('#btn-start-upload');
    const clearStagedBtn = this.container.querySelector('#btn-clear-staged');
    const typeSelect = this.container.querySelector('#upload-image-type');

    if (dropzone && fileInput) {
      dropzone.addEventListener('click', () => fileInput.click());

      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.classList.add('is-dragover');
      });

      dropzone.addEventListener('dragleave', () => {
        dropzone.classList.remove('is-dragover');
      });

      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.classList.remove('is-dragover');
        if (e.dataTransfer.files?.length) {
          this.handleFilesSelected(Array.from(e.dataTransfer.files));
        }
      });

      fileInput.addEventListener('change', () => {
        if (fileInput.files?.length) {
          this.handleFilesSelected(Array.from(fileInput.files));
        }
      });
    }

    if (clearStagedBtn) {
      clearStagedBtn.addEventListener('click', () => {
        this.selectedFiles = [];
        stagedList.style.display = 'none';
        stagedPreviews.innerHTML = '';
        if (fileInput) fileInput.value = '';
      });
    }

    if (uploadBtn) {
      uploadBtn.addEventListener('click', async () => {
        if (this.isUploading || this.selectedFiles.length === 0) return;
        this.isUploading = true;
        uploadBtn.disabled = true;
        uploadBtn.innerHTML = '<span>Uploading photos...</span>';

        const imageType = typeSelect ? typeSelect.value : 'exterior';
        let successCount = 0;
        let failCount = 0;

        for (let i = 0; i < this.selectedFiles.length; i++) {
          const file = this.selectedFiles[i];
          const displayOrder = this.images.length + i + 1;
          try {
            await adminApi.uploadPropertyImage(this.propertyId, file, imageType, displayOrder, file.name);
            successCount++;
          } catch (err) {
            console.error('Failed to upload image:', file.name, err);
            failCount++;
          }
        }

        if (successCount > 0) {
          adminToast.success(`Successfully uploaded ${successCount} image${successCount > 1 ? 's' : ''}!`);
        }
        if (failCount > 0) {
          adminToast.error(`Failed to upload ${failCount} image${failCount > 1 ? 's' : ''}.`);
        }

        this.selectedFiles = [];
        this.isUploading = false;
        await this.loadImages();
        this.render();
      });
    }

    // Reorder buttons (Move Up / Down)
    this.container.querySelectorAll('.btn-move-up').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx > 0) {
          await this.swapImages(idx, idx - 1);
        }
      });
    });

    this.container.querySelectorAll('.btn-move-down').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const idx = parseInt(btn.dataset.index, 10);
        if (idx < this.images.length - 1) {
          await this.swapImages(idx, idx + 1);
        }
      });
    });

    // Delete buttons
    this.container.querySelectorAll('.btn-delete-image').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const imageId = btn.dataset.id;
        const imageUrl = decodeURIComponent(btn.dataset.url || '');
        if (confirm('Are you sure you want to delete this photo? This will remove it from the database and storage.')) {
          btn.disabled = true;
          btn.textContent = 'Deleting...';
          try {
            await adminApi.deletePropertyImage(imageId, imageUrl);
            adminToast.success('Photo deleted successfully.');
            await this.loadImages();
            this.render();
          } catch (err) {
            console.error('Delete failed:', err);
            adminToast.error(err.message || 'Failed to delete photo.');
            btn.disabled = false;
            btn.textContent = '🗑 Delete';
          }
        }
      });
    });
  }

  handleFilesSelected(files) {
    const validFiles = files.filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) {
      adminToast.error('Please select valid image files (JPG, PNG, WEBP).');
      return;
    }

    this.selectedFiles = [...this.selectedFiles, ...validFiles];
    const stagedList = this.container.querySelector('#staged-files-list');
    const stagedPreviews = this.container.querySelector('#staged-previews-grid');
    const stagedCountLabel = this.container.querySelector('#staged-count-label');

    if (stagedList && stagedPreviews) {
      stagedList.style.display = 'block';
      if (stagedCountLabel) {
        stagedCountLabel.textContent = `${this.selectedFiles.length} file${this.selectedFiles.length > 1 ? 's' : ''} staged for upload`;
      }

      stagedPreviews.innerHTML = '';
      this.selectedFiles.forEach((file, index) => {
        const thumb = document.createElement('div');
        thumb.className = 'staged-thumb';
        const imgUrl = URL.createObjectURL(file);
        thumb.innerHTML = `
          <img src="${imgUrl}" alt="${this.escapeHtml(file.name)}" />
          <span class="staged-name">${this.escapeHtml(file.name)}</span>
          <button type="button" class="btn-remove-staged" data-index="${index}">&times;</button>
        `;
        thumb.querySelector('.btn-remove-staged').addEventListener('click', (e) => {
          e.stopPropagation();
          this.selectedFiles.splice(index, 1);
          this.handleFilesSelected([]); // Refresh
        });
        stagedPreviews.appendChild(thumb);
      });
    }
  }

  async swapImages(idxA, idxB) {
    const imgA = this.images[idxA];
    const imgB = this.images[idxB];
    if (!imgA || !imgB) return;

    const orderA = imgA.display_order ?? idxA;
    const orderB = imgB.display_order ?? idxB;

    try {
      // Swap order values in DB
      await adminApi.updateImageOrder(imgA.id, orderB);
      await adminApi.updateImageOrder(imgB.id, orderA);
      adminToast.success('Image display order updated.');
      await this.loadImages();
      this.render();
    } catch (err) {
      console.error('Reordering failed:', err);
      adminToast.error('Failed to update image order.');
    }
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
