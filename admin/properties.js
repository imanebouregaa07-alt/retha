/**
 * RETHA Admin Panel — Properties CRUD Controller
 * Manages Properties List, Add New Property form, Edit Property form,
 * Delete Property with confirmation, status history triggers, and image gallery tab.
 */
import { adminApi } from './api.js';
import { adminToast } from './toast.js';
import { AdminImageManager } from './images.js';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

export class AdminProperties {
  constructor(router) {
    this.router = router;
    this.properties = [];
    this.currentProperty = null;
    this.filterStatus = 'all';
    this.filterType = 'all';
    this.searchQuery = '';
    this.imageManager = null;
    this.newMap = null;
    this.editMap = null;
  }

  // --- 1. PROPERTIES LIST VIEW ---
  async renderList(container) {
    if (!this.router.currentUser) {
      if (container) container.innerHTML = '';
      this.router.handleAuthRequired();
      return;
    }

    container.innerHTML = `
      <div class="admin-view-header">
        <div class="view-header-title">
          <h2>Properties Portfolio</h2>
          <p class="view-header-desc">Manage verified luxury assets, pricing, availability status, and architectural details.</p>
        </div>
        <div class="view-header-actions">
          <button type="button" id="btn-add-property" class="admin-btn admin-btn-primary">
            <span>+ Add New Property</span>
          </button>
        </div>
      </div>

      <!-- METRIC CARDS -->
      <div class="admin-stats-grid" id="properties-stats-grid">
        <div class="stat-card">
          <div class="stat-label">Total Verified Assets</div>
          <div class="stat-value" id="stat-total-props">-</div>
        </div>
        <div class="stat-card stat-available">
          <div class="stat-label">Available (متاح)</div>
          <div class="stat-value" id="stat-available-props">-</div>
        </div>
        <div class="stat-card stat-reserved">
          <div class="stat-label">Reserved (محجوز)</div>
          <div class="stat-value" id="stat-reserved-props">-</div>
        </div>
        <div class="stat-card stat-sold">
          <div class="stat-label">Sold (تم البيع)</div>
          <div class="stat-value" id="stat-sold-props">-</div>
        </div>
      </div>

      <!-- FILTER & SEARCH BAR -->
      <div class="admin-filter-bar">
        <div class="filter-search-box">
          <span class="search-icon">🔍</span>
          <input
            type="text"
            id="properties-search-input"
            class="admin-input"
            placeholder="Search by title, ref code, city, neighborhood..."
            value="${this.escapeHtml(this.searchQuery)}"
          />
        </div>

        <div class="filter-controls-group">
          <div class="form-group-inline">
            <label for="filter-prop-status">Status:</label>
            <select id="filter-prop-status" class="admin-select">
              <option value="all" ${this.filterStatus === 'all' ? 'selected' : ''}>All Statuses</option>
              <option value="available" ${this.filterStatus === 'available' ? 'selected' : ''}>Available (متاح)</option>
              <option value="reserved" ${this.filterStatus === 'reserved' || this.filterStatus === 'pending' ? 'selected' : ''}>Reserved (تم الحجز)</option>
              <option value="sold" ${this.filterStatus === 'sold' ? 'selected' : ''}>Sold (تم البيع)</option>
            </select>
          </div>

          <div class="form-group-inline">
            <label for="filter-prop-type">Type:</label>
            <select id="filter-prop-type" class="admin-select">
              <option value="all" ${this.filterType === 'all' ? 'selected' : ''}>All Types</option>
              <option value="villa" ${this.filterType === 'villa' ? 'selected' : ''}>Villa</option>
              <option value="apartment" ${this.filterType === 'apartment' ? 'selected' : ''}>Apartment</option>
              <option value="office" ${this.filterType === 'office' ? 'selected' : ''}>Office</option>
              <option value="land" ${this.filterType === 'land' ? 'selected' : ''}>Land</option>
            </select>
          </div>
        </div>
      </div>

      <!-- TABLE CONTAINER -->
      <div class="admin-table-container">
        <div id="properties-table-loading" class="table-loading-spinner">
          Loading properties from Supabase...
        </div>
        <div id="properties-table-wrapper" style="display: none;"></div>
      </div>
    `;

    // Bind header actions
    container.querySelector('#btn-add-property').addEventListener('click', () => {
      this.router.navigate('properties/new');
    });

    const searchInput = container.querySelector('#properties-search-input');
    let debounceTimer;
    searchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        this.searchQuery = e.target.value;
        this.loadAndRenderTable(container);
      }, 250);
    });

    container.querySelector('#filter-prop-status').addEventListener('change', (e) => {
      this.filterStatus = e.target.value;
      this.loadAndRenderTable(container);
    });

    container.querySelector('#filter-prop-type').addEventListener('change', (e) => {
      this.filterType = e.target.value;
      this.loadAndRenderTable(container);
    });

    await this.loadAndRenderTable(container);
  }

  async loadAndRenderTable(container) {
    const loadingEl = container.querySelector('#properties-table-loading');
    const tableWrapper = container.querySelector('#properties-table-wrapper');

    if (loadingEl) loadingEl.style.display = 'block';
    if (tableWrapper) tableWrapper.style.display = 'none';

    try {
      this.properties = await adminApi.getProperties({
        search: this.searchQuery,
        status: this.filterStatus,
        propertyType: this.filterType
      });

      // Update metric cards
      const allProps = await adminApi.getProperties();
      const total = allProps.length;
      const avail = allProps.filter((p) => p.status === 'available').length;
      const res = allProps.filter((p) => p.status === 'reserved' || p.status === 'pending').length;
      const sold = allProps.filter((p) => p.status === 'sold' || p.status === 'notified_sold').length;

      const setStat = (id, val) => {
        const el = container.querySelector(id);
        if (el) el.textContent = val;
      };
      setStat('#stat-total-props', total);
      setStat('#stat-available-props', avail);
      setStat('#stat-reserved-props', res);
      setStat('#stat-sold-props', sold);

      if (loadingEl) loadingEl.style.display = 'none';
      if (tableWrapper) {
        tableWrapper.style.display = 'block';

        if (this.properties.length === 0) {
          tableWrapper.innerHTML = `
            <div class="admin-empty-state">
              <span class="empty-icon">🏢</span>
              <p>No properties found matching current criteria.</p>
              <button type="button" class="admin-btn admin-btn-sm admin-btn-secondary" id="btn-reset-prop-filters">
                Reset Filters
              </button>
            </div>
          `;
          const resetBtn = tableWrapper.querySelector('#btn-reset-prop-filters');
          if (resetBtn) {
            resetBtn.addEventListener('click', () => {
              this.searchQuery = '';
              this.filterStatus = 'all';
              this.filterType = 'all';
              this.renderList(container);
            });
          }
          return;
        }

        tableWrapper.innerHTML = `
          <table class="admin-table">
            <thead>
              <tr>
                <th>Property</th>
                <th>Reference Code</th>
                <th>Location</th>
                <th>Price</th>
                <th>Type / Area</th>
                <th class="status-cell">Status</th>
                <th>Images</th>
                <th>Created</th>
                <th class="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${this.properties
                .map((prop) => {
                  const thumbnailImg = this.getPrimaryThumbnail(prop);
                  const priceStr = prop.price
                    ? `SAR ${Number(prop.price).toLocaleString('en-US')}`
                    : '<span class="text-muted">Price on Request</span>';
                  const areaStr = prop.area_sqm ? `${prop.area_sqm} m²` : '-';
                  const dateStr = prop.created_at ? new Date(prop.created_at).toLocaleDateString('en-GB') : '-';
                  const imgCount = prop.property_images?.length || 0;

                  return `
                  <tr data-id="${prop.id}">
                    <td>
                      <div class="table-property-cell">
                        <div class="table-property-thumb">
                          ${
                            thumbnailImg
                              ? `<img src="${thumbnailImg}" alt="${this.escapeHtml(prop.title || '')}" loading="lazy" />`
                              : `<div class="thumb-placeholder">🏢</div>`
                          }
                        </div>
                        <div class="table-property-meta">
                          <span class="prop-title-text" title="${this.escapeHtml(prop.title)}">${this.escapeHtml(prop.title)}</span>
                          ${prop.title_ar ? `<span class="prop-title-ar">${this.escapeHtml(prop.title_ar)}</span>` : ''}
                        </div>
                      </div>
                    </td>
                    <td>
                      <code class="ref-code-tag">${this.escapeHtml(prop.reference_code || 'N/A')}</code>
                    </td>
                    <td>
                      <span class="location-text">
                        ${this.escapeHtml(prop.neighborhood ? `${prop.neighborhood}, ${prop.city || 'Riyadh'}` : prop.city || 'Riyadh')}
                      </span>
                    </td>
                    <td>
                      <span class="price-text">${priceStr}</span>
                    </td>
                    <td>
                      <span class="type-badge">${this.escapeHtml(prop.property_type || 'Property')}</span>
                      <span class="area-subtext">${areaStr}</span>
                    </td>
                    <td class="status-cell">
                      <span class="status-badge status-${prop.status || 'available'}">
                        ${this.formatStatus(prop.status)}
                      </span>
                    </td>
                    <td>
                      <span class="badge-count">${imgCount} 📷</span>
                    </td>
                    <td>
                      <span class="date-text">${dateStr}</span>
                    </td>
                    <td class="text-right">
                      <div class="table-actions-group">
                        <button
                          type="button"
                          class="admin-btn admin-btn-xs admin-btn-secondary btn-edit-prop"
                          data-id="${prop.id}"
                          title="Edit Property & Photos"
                        >
                          ✏️ Edit
                        </button>
                        <button
                          type="button"
                          class="admin-btn admin-btn-xs admin-btn-danger btn-delete-prop"
                          data-id="${prop.id}"
                          data-title="${this.escapeHtml(prop.title)}"
                          title="Delete Property"
                        >
                          🗑
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
                })
                .join('')}
            </tbody>
          </table>
        `;

        // Bind table action events
        tableWrapper.querySelectorAll('.btn-edit-prop').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.router.navigate(`properties/edit/${btn.dataset.id}`);
          });
        });

        tableWrapper.querySelectorAll('.btn-delete-prop').forEach((btn) => {
          btn.addEventListener('click', () => {
            this.confirmDelete(btn.dataset.id, btn.dataset.title, container);
          });
        });
      }
    } catch (err) {
      console.error('Failed to load properties:', err);
      adminToast.error('Failed to load properties table.');
      if (loadingEl) {
        loadingEl.innerHTML = `<span class="text-danger">Error: ${this.escapeHtml(err.message)}</span>`;
      }
    }
  }

  // --- 2. ADD NEW PROPERTY FORM ---
  renderAddForm(container) {
    if (!this.router.currentUser) {
      if (container) container.innerHTML = '';
      this.router.handleAuthRequired();
      return;
    }

    container.innerHTML = `
      <div class="admin-view-header">
        <div class="view-header-title">
          <button type="button" class="btn-back-link" id="btn-back-props">← Back to Properties</button>
          <h2>Add New Property</h2>
          <p class="view-header-desc">Create a new certified listing. All fields are directly synchronized with the database.</p>
        </div>
      </div>

      <div class="admin-card form-card-container">
        <form id="property-add-form" class="admin-form">
          <div class="form-section-title">Core Listing Information</div>
          <div class="form-grid-2">
            <div class="form-group">
              <label for="prop-title">Property Title (English) <span class="required">*</span></label>
              <input type="text" id="prop-title" required class="admin-input" placeholder="e.g. Villa Al-Malqa Grand Residence" />
            </div>
            <div class="form-group">
              <label for="prop-title-ar">Property Title (Arabic)</label>
              <input type="text" id="prop-title-ar" class="admin-input" placeholder="e.g. فيلا الملقا الملكية الفاخرة" dir="rtl" />
            </div>
          </div>

          <div class="form-grid-3">
            <div class="form-group">
              <label for="prop-ref-code">Reference Code <span class="required">*</span></label>
              <input type="text" id="prop-ref-code" required class="admin-input" placeholder="e.g. REGA-FAL-1200028491-09" />
              <span class="form-hint">Unique official authority reference number</span>
            </div>
            <div class="form-group">
              <label for="prop-type">Property Type</label>
              <select id="prop-type" class="admin-select">
                <option value="villa">Villa (فيلا)</option>
                <option value="apartment">Apartment (شقة فاخرة)</option>
                <option value="office">Office / Commercial (مكتبي / تجاري)</option>
                <option value="land">Investment Land (أرض استثمارية)</option>
              </select>
            </div>
            <div class="form-group">
              <label for="prop-status">Status <span class="required">*</span></label>
              <select id="prop-status" required class="admin-select">
                <option value="available" selected>Available (متاح)</option>
                <option value="reserved">Reserved (تم الحجز)</option>
                <option value="sold">Sold (تم البيع)</option>
              </select>
              <span class="form-hint">Limited strictly to available, reserved, sold</span>
            </div>
          </div>

          <div class="form-group">
            <label for="prop-description">Detailed Architectural Description</label>
            <textarea id="prop-description" rows="4" class="admin-textarea" placeholder="Comprehensive description of the architectural design, master suites, smart systems, and lifestyle amenities..."></textarea>
          </div>

          <div class="form-section-title mt-4">Pricing & Dimensions</div>
          <div class="form-grid-3">
            <div class="form-group">
              <label for="prop-price">Price (SAR)</label>
              <input type="number" id="prop-price" min="0" step="1000" class="admin-input" placeholder="e.g. 18500000" />
            </div>
            <div class="form-group">
              <label for="prop-area">Plot Area (m²)</label>
              <input type="number" id="prop-area" min="0" step="1" class="admin-input" placeholder="e.g. 850" />
            </div>
            <div class="form-group">
              <label for="prop-built-area">Built-up Area (BUA)</label>
              <input type="text" id="prop-built-area" class="admin-input" placeholder="e.g. 1,120 m²" />
            </div>
          </div>

          <div class="form-section-title mt-4">Location & Coordinates</div>
          <!-- Interactive Map Coordinates Picker -->
          <div class="admin-map-picker-container">
            <div class="admin-map-picker-header">
              <span class="admin-map-instruction">
                <span class="map-pin-icon">📍</span>
                <strong>Interactive Location Picker:</strong> Click map or drag marker to set exact coordinates
              </span>
              <span class="admin-map-coords-badge" id="new-prop-coords-badge">Click map to place pin</span>
            </div>
            <div id="new-property-map" class="admin-property-picker-map"></div>
          </div>
          <div class="form-grid-4">
            <div class="form-group">
              <label for="prop-city">City</label>
              <input type="text" id="prop-city" class="admin-input" value="Riyadh" placeholder="e.g. Riyadh" />
            </div>
            <div class="form-group">
              <label for="prop-neighborhood">Neighborhood / District</label>
              <input type="text" id="prop-neighborhood" class="admin-input" placeholder="e.g. Al-Malqa" />
            </div>
            <div class="form-group">
              <label for="prop-lat">Latitude</label>
              <input type="number" id="prop-lat" step="0.000001" class="admin-input" placeholder="e.g. 24.8125" />
            </div>
            <div class="form-group">
              <label for="prop-lng">Longitude</label>
              <input type="number" id="prop-lng" step="0.000001" class="admin-input" placeholder="e.g. 46.6214" />
            </div>
          </div>

          <div class="form-section-title mt-4">Specifications & Verification</div>
          <div class="form-grid-4">
            <div class="form-group">
              <label for="prop-bedrooms">Bedrooms</label>
              <input type="number" id="prop-bedrooms" min="0" class="admin-input" placeholder="e.g. 6" />
            </div>
            <div class="form-group">
              <label for="prop-bathrooms">Bathrooms</label>
              <input type="number" id="prop-bathrooms" min="0" class="admin-input" placeholder="e.g. 8" />
            </div>
            <div class="form-group">
              <label for="prop-deed">Electronic Deed #</label>
              <input type="text" id="prop-deed" class="admin-input" placeholder="e.g. 310108003941" />
            </div>
            <div class="form-group">
              <label for="prop-badge">Highlight Badge</label>
              <input type="text" id="prop-badge" class="admin-input" placeholder="e.g. PALACE EDITION" />
            </div>
          </div>

          <div class="form-footer-actions mt-4">
            <button type="submit" id="btn-save-new-prop" class="admin-btn admin-btn-primary">
              <span>Save & Continue to Media</span>
              <span class="btn-arrow">→</span>
            </button>
            <button type="button" id="btn-cancel-add-prop" class="admin-btn admin-btn-secondary">
              Cancel
            </button>
          </div>
        </form>
      </div>
    `;

    // Initialize interactive map for new property
    this.newMap = this.initLocationMap({
      mapContainerId: 'new-property-map',
      latInputId: 'prop-lat',
      lngInputId: 'prop-lng',
      neighborhoodInputId: 'prop-neighborhood',
      badgeId: 'new-prop-coords-badge',
      initialLat: null,
      initialLng: null
    });

    // Bind back / cancel
    container.querySelector('#btn-back-props').addEventListener('click', () => {
      this.router.navigate('properties');
    });
    container.querySelector('#btn-cancel-add-prop').addEventListener('click', () => {
      this.router.navigate('properties');
    });

    // Form submit
    const form = container.querySelector('#property-add-form');
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const saveBtn = container.querySelector('#btn-save-new-prop');
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<span>Saving property...</span>';

      const payload = {
        title: container.querySelector('#prop-title').value.trim(),
        title_ar: container.querySelector('#prop-title-ar').value.trim() || null,
        reference_code: container.querySelector('#prop-ref-code').value.trim() || null,
        property_type: container.querySelector('#prop-type').value || null,
        status: container.querySelector('#prop-status').value || 'available',
        description: container.querySelector('#prop-description').value.trim() || null,
        price: container.querySelector('#prop-price').value ? Number(container.querySelector('#prop-price').value) : null,
        area_sqm: container.querySelector('#prop-area').value ? Number(container.querySelector('#prop-area').value) : null,
        built_up_area: container.querySelector('#prop-built-area').value.trim() || null,
        city: container.querySelector('#prop-city').value.trim() || 'Riyadh',
        neighborhood: container.querySelector('#prop-neighborhood').value.trim() || null,
        latitude: container.querySelector('#prop-lat').value ? Number(container.querySelector('#prop-lat').value) : null,
        longitude: container.querySelector('#prop-lng').value ? Number(container.querySelector('#prop-lng').value) : null,
        bedrooms: container.querySelector('#prop-bedrooms').value ? Number(container.querySelector('#prop-bedrooms').value) : null,
        bathrooms: container.querySelector('#prop-bathrooms').value ? Number(container.querySelector('#prop-bathrooms').value) : null,
        deed_number: container.querySelector('#prop-deed').value.trim() || null,
        badge: container.querySelector('#prop-badge').value.trim() || null
      };

      try {
        const created = await adminApi.createProperty(payload);
        adminToast.success('Property created successfully! You can now manage photos.');
        this.router.navigate(`properties/edit/${created.id}`);
      } catch (err) {
        console.error('Create property failed:', err);
        adminToast.error(err.message || 'Failed to create property.');
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<span>Save & Continue to Media</span> <span class="btn-arrow">→</span>';
      }
    });
  }

  // --- 3. EDIT PROPERTY FORM WITH TABS (DETAILS + IMAGES + STATUS AUDIT) ---
  async renderEditForm(container, propertyId) {
    if (!this.router.currentUser) {
      if (container) container.innerHTML = '';
      this.router.handleAuthRequired();
      return;
    }

    container.innerHTML = `
      <div id="prop-edit-loading" class="table-loading-spinner">
        Loading property details for inspection...
      </div>
      <div id="prop-edit-content" style="display: none;"></div>
    `;

    try {
      this.currentProperty = await adminApi.getPropertyById(propertyId);
      const prop = this.currentProperty;

      const editContent = container.querySelector('#prop-edit-content');
      container.querySelector('#prop-edit-loading').style.display = 'none';
      editContent.style.display = 'block';

      editContent.innerHTML = `
        <div class="admin-view-header">
          <div class="view-header-title">
            <button type="button" class="btn-back-link" id="btn-back-props-edit">← Back to Properties</button>
            <div class="edit-title-row">
              <h2>Edit Property: ${this.escapeHtml(prop.title)}</h2>
              <span class="status-badge status-${prop.status}">${this.formatStatus(prop.status)}</span>
            </div>
            <p class="view-header-desc">
              Reference: <code>${this.escapeHtml(prop.reference_code || 'N/A')}</code> • ID: <code>${prop.id}</code>
            </p>
          </div>
          <div class="view-header-actions">
            <button type="button" id="btn-delete-this-prop" class="admin-btn admin-btn-danger">
              🗑 Delete Property
            </button>
          </div>
        </div>

        <!-- TABS BAR -->
        <div class="admin-tabs-bar">
          <button type="button" class="admin-tab-btn active" data-tab="tab-details">
            📝 Details & Specifications
          </button>
          <button type="button" class="admin-tab-btn" data-tab="tab-images">
            📷 Photos & Media Gallery (${prop.property_images?.length || 0})
          </button>
          <button type="button" class="admin-tab-btn" data-tab="tab-history">
            📜 Status Audit Log (${prop.property_status_history?.length || 0})
          </button>
        </div>

        <!-- TAB 1: DETAILS -->
        <div id="tab-details" class="tab-pane active">
          <div class="admin-card form-card-container">
            <form id="property-edit-form" class="admin-form">
              <div class="form-section-title">Core Listing Information</div>
              <div class="form-grid-2">
                <div class="form-group">
                  <label for="edit-prop-title">Property Title (English) <span class="required">*</span></label>
                  <input type="text" id="edit-prop-title" required class="admin-input" value="${this.escapeHtml(prop.title || '')}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-title-ar">Property Title (Arabic)</label>
                  <input type="text" id="edit-prop-title-ar" class="admin-input" value="${this.escapeHtml(prop.title_ar || '')}" dir="rtl" />
                </div>
              </div>

              <div class="form-grid-3">
                <div class="form-group">
                  <label for="edit-prop-ref-code">Reference Code <span class="required">*</span></label>
                  <input type="text" id="edit-prop-ref-code" required class="admin-input" value="${this.escapeHtml(prop.reference_code || '')}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-type">Property Type</label>
                  <select id="edit-prop-type" class="admin-select">
                    <option value="villa" ${prop.property_type === 'villa' ? 'selected' : ''}>Villa (فيلا)</option>
                    <option value="apartment" ${prop.property_type === 'apartment' ? 'selected' : ''}>Apartment (شقة فاخرة)</option>
                    <option value="office" ${prop.property_type === 'office' ? 'selected' : ''}>Office / Commercial (مكتبي / تجاري)</option>
                    <option value="land" ${prop.property_type === 'land' ? 'selected' : ''}>Investment Land (أرض استثمارية)</option>
                  </select>
                </div>
                <div class="form-group">
                  <label for="edit-prop-status">Status (triggers audit log) <span class="required">*</span></label>
                  <select id="edit-prop-status" required class="admin-select status-select-${prop.status}">
                    <option value="available" ${prop.status === 'available' ? 'selected' : ''}>Available (متاح)</option>
                    <option value="reserved" ${prop.status === 'reserved' || prop.status === 'pending' ? 'selected' : ''}>Reserved (تم الحجز)</option>
                    <option value="sold" ${prop.status === 'sold' ? 'selected' : ''}>Sold (تم البيع)</option>
                  </select>
                  <span class="form-hint">Any status change triggers automatic audit log</span>
                </div>
              </div>

              <div class="form-group">
                <label for="edit-prop-description">Detailed Architectural Description</label>
                <textarea id="edit-prop-description" rows="4" class="admin-textarea">${this.escapeHtml(prop.description || '')}</textarea>
              </div>

              <div class="form-section-title mt-4">Pricing & Dimensions</div>
              <div class="form-grid-3">
                <div class="form-group">
                  <label for="edit-prop-price">Price (SAR)</label>
                  <input type="number" id="edit-prop-price" min="0" step="1000" class="admin-input" value="${prop.price ?? ''}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-area">Plot Area (m²)</label>
                  <input type="number" id="edit-prop-area" min="0" step="1" class="admin-input" value="${prop.area_sqm ?? ''}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-built-area">Built-up Area (BUA)</label>
                  <input type="text" id="edit-prop-built-area" class="admin-input" value="${this.escapeHtml(prop.built_up_area || '')}" />
                </div>
              </div>

              <div class="form-section-title mt-4">Location & Coordinates</div>
              <!-- Interactive Map Coordinates Picker -->
              <div class="admin-map-picker-container">
                <div class="admin-map-picker-header">
                  <span class="admin-map-instruction">
                    <span class="map-pin-icon">📍</span>
                    <strong>Interactive Location Picker:</strong> Click map or drag marker to adjust coordinates
                  </span>
                  <span class="admin-map-coords-badge" id="edit-prop-coords-badge">${prop.latitude && prop.longitude ? `${Number(prop.latitude).toFixed(6)}, ${Number(prop.longitude).toFixed(6)}` : 'Click map to place pin'}</span>
                </div>
                <div id="edit-property-map" class="admin-property-picker-map"></div>
              </div>
              <div class="form-grid-4">
                <div class="form-group">
                  <label for="edit-prop-city">City</label>
                  <input type="text" id="edit-prop-city" class="admin-input" value="${this.escapeHtml(prop.city || 'Riyadh')}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-neighborhood">Neighborhood / District</label>
                  <input type="text" id="edit-prop-neighborhood" class="admin-input" value="${this.escapeHtml(prop.neighborhood || '')}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-lat">Latitude</label>
                  <input type="number" id="edit-prop-lat" step="0.000001" class="admin-input" value="${prop.latitude ?? ''}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-lng">Longitude</label>
                  <input type="number" id="edit-prop-lng" step="0.000001" class="admin-input" value="${prop.longitude ?? ''}" />
                </div>
              </div>

              <div class="form-section-title mt-4">Specifications & Verification</div>
              <div class="form-grid-4">
                <div class="form-group">
                  <label for="edit-prop-bedrooms">Bedrooms</label>
                  <input type="number" id="edit-prop-bedrooms" min="0" class="admin-input" value="${prop.bedrooms ?? ''}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-bathrooms">Bathrooms</label>
                  <input type="number" id="edit-prop-bathrooms" min="0" class="admin-input" value="${prop.bathrooms ?? ''}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-deed">Electronic Deed #</label>
                  <input type="text" id="edit-prop-deed" class="admin-input" value="${this.escapeHtml(prop.deed_number || '')}" />
                </div>
                <div class="form-group">
                  <label for="edit-prop-badge">Highlight Badge</label>
                  <input type="text" id="edit-prop-badge" class="admin-input" value="${this.escapeHtml(prop.badge || '')}" />
                </div>
              </div>

              <div class="form-footer-actions mt-4">
                <button type="submit" id="btn-save-edit-prop" class="admin-btn admin-btn-primary">
                  <span>Save Changes</span>
                  <span class="btn-arrow">✓</span>
                </button>
                <button type="button" id="btn-cancel-edit-prop" class="admin-btn admin-btn-secondary">
                  Back
                </button>
              </div>
            </form>
          </div>
        </div>

        <!-- TAB 2: IMAGES -->
        <div id="tab-images" class="tab-pane">
          <div id="property-images-container"></div>
        </div>

        <!-- TAB 3: STATUS AUDIT HISTORY -->
        <div id="tab-history" class="tab-pane">
          <div class="admin-card">
            <h3 class="admin-section-title">Property Status Change Audit Trail</h3>
            <p class="admin-section-desc">
              Logged automatically by PostgreSQL trigger <code>trg_log_property_status_change</code>.
            </p>
            <div id="prop-history-table-container">
              ${this.renderHistoryTable(prop.property_status_history || [])}
            </div>
          </div>
        </div>
      `;

      // Initialize interactive map for edit property
      this.editMap = this.initLocationMap({
        mapContainerId: 'edit-property-map',
        latInputId: 'edit-prop-lat',
        lngInputId: 'edit-prop-lng',
        neighborhoodInputId: 'edit-prop-neighborhood',
        badgeId: 'edit-prop-coords-badge',
        initialLat: prop.latitude,
        initialLng: prop.longitude
      });

      // Back buttons
      editContent.querySelector('#btn-back-props-edit').addEventListener('click', () => {
        if (this.editMap) { this.editMap.remove(); this.editMap = null; }
        this.router.navigate('properties');
      });
      editContent.querySelector('#btn-cancel-edit-prop').addEventListener('click', () => {
        if (this.editMap) { this.editMap.remove(); this.editMap = null; }
        this.router.navigate('properties');
      });

      // Delete property button
      editContent.querySelector('#btn-delete-this-prop').addEventListener('click', () => {
        this.confirmDelete(prop.id, prop.title, container);
      });

      // Tab switching
      editContent.querySelectorAll('.admin-tab-btn').forEach((tabBtn) => {
        tabBtn.addEventListener('click', () => {
          editContent.querySelectorAll('.admin-tab-btn').forEach((b) => b.classList.remove('active'));
          editContent.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));
          tabBtn.classList.add('active');
          const target = editContent.querySelector(`#${tabBtn.dataset.tab}`);
          if (target) target.classList.add('active');

          if (tabBtn.dataset.tab === 'tab-details' && this.editMap) {
            setTimeout(() => this.editMap.invalidateSize(), 60);
          }

          if (tabBtn.dataset.tab === 'tab-images' && !this.imageManager) {
            const imagesContainer = editContent.querySelector('#property-images-container');
            this.imageManager = new AdminImageManager(prop.id, imagesContainer);
            this.imageManager.init();
          }
        });
      });

      // Form submit for details
      const form = editContent.querySelector('#property-edit-form');
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const saveBtn = editContent.querySelector('#btn-save-edit-prop');
        saveBtn.disabled = true;
        saveBtn.innerHTML = '<span>Saving changes...</span>';

        const payload = {
          title: editContent.querySelector('#edit-prop-title').value.trim(),
          title_ar: editContent.querySelector('#edit-prop-title-ar').value.trim() || null,
          reference_code: editContent.querySelector('#edit-prop-ref-code').value.trim() || null,
          property_type: editContent.querySelector('#edit-prop-type').value || null,
          status: editContent.querySelector('#edit-prop-status').value || 'available',
          description: editContent.querySelector('#edit-prop-description').value.trim() || null,
          price: editContent.querySelector('#edit-prop-price').value ? Number(editContent.querySelector('#edit-prop-price').value) : null,
          area_sqm: editContent.querySelector('#edit-prop-area').value ? Number(editContent.querySelector('#edit-prop-area').value) : null,
          built_up_area: editContent.querySelector('#edit-prop-built-area').value.trim() || null,
          city: editContent.querySelector('#edit-prop-city').value.trim() || 'Riyadh',
          neighborhood: editContent.querySelector('#edit-prop-neighborhood').value.trim() || null,
          latitude: editContent.querySelector('#edit-prop-lat').value ? Number(editContent.querySelector('#edit-prop-lat').value) : null,
          longitude: editContent.querySelector('#edit-prop-lng').value ? Number(editContent.querySelector('#edit-prop-lng').value) : null,
          bedrooms: editContent.querySelector('#edit-prop-bedrooms').value ? Number(editContent.querySelector('#edit-prop-bedrooms').value) : null,
          bathrooms: editContent.querySelector('#edit-prop-bathrooms').value ? Number(editContent.querySelector('#edit-prop-bathrooms').value) : null,
          deed_number: editContent.querySelector('#edit-prop-deed').value.trim() || null,
          badge: editContent.querySelector('#edit-prop-badge').value.trim() || null
        };

        try {
          const updated = await adminApi.updateProperty(prop.id, payload);
          adminToast.success('Property updated successfully!');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<span>Save Changes</span> <span class="btn-arrow">✓</span>';
          // Re-render edit form to sync status history
          this.renderEditForm(container, prop.id);
        } catch (err) {
          console.error('Update failed:', err);
          adminToast.error(err.message || 'Failed to update property.');
          saveBtn.disabled = false;
          saveBtn.innerHTML = '<span>Save Changes</span> <span class="btn-arrow">✓</span>';
        }
      });
    } catch (err) {
      console.error('Failed to load property for edit:', err);
      adminToast.error('Could not find property.');
      this.router.navigate('properties');
    }
  }

  renderHistoryTable(historyList) {
    if (!historyList || historyList.length === 0) {
      return `
        <div class="admin-empty-state">
          <span class="empty-icon">📜</span>
          <p>No status changes recorded yet for this property.</p>
          <span class="empty-hint">Status updates are automatically logged with timestamp and user role.</span>
        </div>
      `;
    }

    return `
      <table class="admin-table admin-table-compact mt-3">
        <thead>
          <tr>
            <th>Date & Time</th>
            <th>Old Status</th>
            <th>New Status</th>
            <th>Modified Via</th>
          </tr>
        </thead>
        <tbody>
          ${historyList
            .map(
              (item) => `
            <tr>
              <td>${item.changed_at ? new Date(item.changed_at).toLocaleString('en-GB') : '-'}</td>
              <td><span class="status-badge status-${item.old_status || 'none'}">${this.formatStatus(item.old_status)}</span></td>
              <td><span class="status-badge status-${item.new_status}">${this.formatStatus(item.new_status)}</span></td>
              <td><code>${this.escapeHtml(item.changed_via || 'system')}</code></td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
  }

  // --- 4. CONFIRM DELETE DIALOG ---
  confirmDelete(id, title, parentContainer) {
    const dialog = document.createElement('div');
    dialog.className = 'admin-modal-backdrop';
    dialog.innerHTML = `
      <div class="admin-modal-dialog">
        <div class="admin-modal-header">
          <span class="modal-warning-icon">⚠️</span>
          <h3>Delete Property Confirmation</h3>
        </div>
        <div class="admin-modal-body">
          <p>Are you sure you want to permanently delete <strong>"${this.escapeHtml(title)}"</strong>?</p>
          <p class="modal-warning-text">
            This action cannot be undone. All associated gallery photos, status audit logs, and lead references will be permanently removed.
          </p>
        </div>
        <div class="admin-modal-footer">
          <button type="button" class="admin-btn admin-btn-secondary" id="modal-cancel-delete">Cancel</button>
          <button type="button" class="admin-btn admin-btn-danger" id="modal-confirm-delete">Permanently Delete</button>
        </div>
      </div>
    `;

    document.body.appendChild(dialog);

    dialog.querySelector('#modal-cancel-delete').addEventListener('click', () => {
      document.body.removeChild(dialog);
    });

    dialog.querySelector('#modal-confirm-delete').addEventListener('click', async () => {
      const confirmBtn = dialog.querySelector('#modal-confirm-delete');
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'Deleting...';

      try {
        await adminApi.deleteProperty(id);
        adminToast.success(`Property "${title}" deleted.`);
        document.body.removeChild(dialog);
        this.router.navigate('properties');
      } catch (err) {
        console.error('Delete error:', err);
        adminToast.error(err.message || 'Failed to delete property.');
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'Permanently Delete';
      }
    });
  }

  /**
   * Initializes interactive Leaflet map for coordinate selection
   */
  initLocationMap({ mapContainerId, latInputId, lngInputId, neighborhoodInputId, badgeId, initialLat, initialLng }) {
    const mapEl = document.getElementById(mapContainerId);
    if (!mapEl) return null;

    // Destroy prior map instance on this DOM node if it exists
    if (mapEl._leaflet_id && mapEl._leaflet_map) {
      try {
        mapEl._leaflet_map.remove();
      } catch (e) {
        console.warn('Map cleanup warning:', e);
      }
      mapEl._leaflet_id = null;
    }

    const hasInitialCoords = initialLat !== null && initialLat !== undefined && initialLng !== null && initialLng !== undefined && !isNaN(initialLat) && !isNaN(initialLng) && Number(initialLat) !== 0;
    const defaultLat = hasInitialCoords ? Number(initialLat) : 24.7740;
    const defaultLng = hasInitialCoords ? Number(initialLng) : 46.6320;

    const map = L.map(mapContainerId, {
      center: [defaultLat, defaultLng],
      zoom: hasInitialCoords ? 15 : 12,
      scrollWheelZoom: true
    });
    mapEl._leaflet_map = map;

    // Standard OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(map);

    const goldPin = L.divIcon({
      className: 'admin-marker-pin-wrap',
      html: `
        <div class="admin-marker-pin">
          <svg width="34" height="44" viewBox="0 0 34 44" fill="none">
            <path d="M17 0C7.61 0 0 7.61 0 17C0 29.75 17 44 17 44C17 44 34 29.75 34 17C34 7.61 26.39 0 17 0Z" fill="#D4AF37"/>
            <circle cx="17" cy="17" r="7" fill="#0B0D13"/>
            <circle cx="17" cy="17" r="4" fill="#F4D375"/>
          </svg>
        </div>
      `,
      iconSize: [34, 44],
      iconAnchor: [17, 44],
      popupAnchor: [0, -44]
    });

    const marker = L.marker([defaultLat, defaultLng], {
      icon: goldPin,
      draggable: true,
      autoPan: true
    }).addTo(map);

    const latInput = document.getElementById(latInputId);
    const lngInput = document.getElementById(lngInputId);
    const badgeEl = document.getElementById(badgeId);

    const updateCoords = (lat, lng, syncInputs = true) => {
      const formattedLat = Number(lat).toFixed(6);
      const formattedLng = Number(lng).toFixed(6);

      if (badgeEl) {
        badgeEl.textContent = `${formattedLat}, ${formattedLng}`;
      }
      if (syncInputs) {
        if (latInput) latInput.value = formattedLat;
        if (lngInput) lngInput.value = formattedLng;
      }
    };

    if (hasInitialCoords) {
      updateCoords(defaultLat, defaultLng, false);
    } else {
      if (badgeEl) badgeEl.textContent = 'Click map or drag pin to position';
    }

    // Drag marker updates coordinates
    marker.on('dragend', (e) => {
      const pos = e.target.getLatLng();
      updateCoords(pos.lat, pos.lng, true);
    });

    // Click anywhere on map to reposition marker
    map.on('click', (e) => {
      const { lat, lng } = e.latlng;
      marker.setLatLng([lat, lng]);
      updateCoords(lat, lng, true);
    });

    // Manual input typing updates map position
    const handleInputSync = () => {
      const latVal = parseFloat(latInput?.value);
      const lngVal = parseFloat(lngInput?.value);
      if (!isNaN(latVal) && !isNaN(lngVal) && latVal >= -90 && latVal <= 90 && lngVal >= -180 && lngVal <= 180) {
        marker.setLatLng([latVal, lngVal]);
        map.panTo([latVal, lngVal]);
        updateCoords(latVal, lngVal, false);
      }
    };

    if (latInput) latInput.addEventListener('input', handleInputSync);
    if (lngInput) lngInput.addEventListener('input', handleInputSync);

    // Known districts auto-pan on neighborhood input
    const neighborhoodInput = document.getElementById(neighborhoodInputId);
    if (neighborhoodInput) {
      const KNOWN_COORDS = {
        'malqa': [24.8150, 46.6025],
        'ملقا': [24.8150, 46.6025],
        'hittin': [24.7720, 46.5980],
        'حطين': [24.7720, 46.5980],
        'hada': [24.6850, 46.6200],
        'هدا': [24.6850, 46.6200],
        'kafd': [24.7680, 46.6430],
        'مالي': [24.7680, 46.6430],
        'salman': [24.8720, 46.6180],
        'سلمان': [24.8720, 46.6180],
        'nakheel': [24.7480, 46.6280],
        'نخيل': [24.7480, 46.6280],
        'yasmin': [24.8320, 46.6480],
        'ياسمين': [24.8320, 46.6480],
        'sahafa': [24.7950, 46.6420],
        'صحافة': [24.7950, 46.6420],
        'rabi': [24.7980, 46.6780],
        'ربيع': [24.7980, 46.6780]
      };

      neighborhoodInput.addEventListener('change', () => {
        const val = neighborhoodInput.value.toLowerCase().trim();
        for (const [key, coords] of Object.entries(KNOWN_COORDS)) {
          if (val.includes(key)) {
            // Only auto-pan if lat/lng are empty or default
            if (!latInput?.value || !lngInput?.value) {
              marker.setLatLng(coords);
              map.flyTo(coords, 14);
              updateCoords(coords[0], coords[1], true);
            }
            break;
          }
        }
      });
    }

    // Leaflet needs invalidateSize once rendered in DOM
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return map;
  }

  getPrimaryThumbnail(prop) {
    const images = Array.isArray(prop.property_images) ? prop.property_images : [];
    // Specifically filter for and display the image where image_type === 'exterior'
    const exteriorImage = images.find(
      (img) => (img.image_type || '').toLowerCase().trim() === 'exterior'
    );
    // If an exterior image does not exist for a property, fallback to the first available image or main_image
    return exteriorImage?.image_url || images[0]?.image_url || prop.main_image || null;
  }

  formatStatus(status) {
    if (!status) return '-';
    const s = String(status).toLowerCase().trim();
    if (s === 'available') return 'Available (متاح)';
    if (s === 'reserved' || s === 'pending') return 'Reserved (تم الحجز)';
    if (s === 'sold' || s === 'notified_sold') return 'Sold (تم البيع)';
    if (s === 'closed') return 'Closed (مغلق)';
    return status;
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
