import { properties, renderStatusBadgeHtml, formatAreaWithUnit, generateDynamicBudgetRanges } from '../data/properties.js';
import { PanoramaViewer } from './three-panorama.js';
import { soundEngine } from './audio-controller.js';
import { supabase } from '../utils/supabase.js';
import { t, getLanguage } from '../i18n/i18n.js';

export class PropertyModal {
  constructor() {
    this.modalEl = document.querySelector('#property-detail-modal');
    this.activeProperty = null;
    this.panoramaViewer = null;
    this.activeGalleryTab = 'exterior';
    this.activePhotoIndex = 0;
    this.currentPhotos = [];
    this.autoPlayTimer = null;
    this.autoPlayInterval = 3500;
    this.isAutoPlayPaused = false;

    this.init();
  }

  init() {
    if (this.modalEl) {
      // Close button
      const closeBtn = this.modalEl.querySelector('.modal-close-btn');
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close());
      }

      // Backdrop click
      this.modalEl.addEventListener('click', (e) => {
        if (e.target === this.modalEl) this.close();
      });
    }

    const inquiryModal = document.querySelector('#property-inquiry-modal');
    if (inquiryModal) {
      inquiryModal.addEventListener('click', (e) => {
        if (e.target === inquiryModal || e.target.classList.contains('inq-modal-close-trigger')) {
          this.closeInquiryModal();
        }
      });
    }

    // Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (this.modalEl && this.modalEl.classList.contains('active')) {
          this.close();
        }
        const inqModal = document.querySelector('#property-inquiry-modal');
        if (inqModal && inqModal.classList.contains('active')) {
          this.closeInquiryModal();
        }
      }
    });
  }

  open(propertyId) {
    const prop = properties.find(p => p.id === propertyId || p.dbId === propertyId || p.slug === propertyId);
    if (!prop) return;

    this.activeProperty = prop;
    soundEngine.playSwoosh();

    this.renderContent(prop);
    this.modalEl.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Start auto-advancing slideshow
    this.startAutoPlay();

    // Track modal open
    window.dispatchEvent(new CustomEvent('propertyModalOpened', { detail: { id: propertyId } }));
  }

  close() {
    this.stopAutoPlay();
    if (this.panoramaViewer) {
      this.panoramaViewer.destroy();
      this.panoramaViewer = null;
    }
    this.modalEl.classList.remove('active');
    document.body.style.overflow = '';
    soundEngine.playClick();
  }

  renderContent(prop) {
    const content = this.modalEl.querySelector('.modal-inner-container');
    if (!content) return;

    // Fetch ALL property images without any hardcoded limits or truncations
    const allPhotos = (prop.images && prop.images.length > 0)
      ? prop.images
      : (prop.gallery?.all && prop.gallery.all.length > 0)
        ? prop.gallery.all
        : [
            ...(prop.gallery?.exterior || []),
            ...(prop.gallery?.interior || [])
          ];

    if (allPhotos.length === 0 && prop.mainImage) {
      allPhotos.push({
        id: 'main-photo',
        url: prop.mainImage,
        title: prop.title || 'Main View',
        desc: prop.location || ''
      });
    }

    const allExterior = prop.gallery?.exterior || [];
    const allInterior = prop.gallery?.interior || [];

    // Requirement 1: Carousel MUST display all images fetched from Supabase by default
    this.currentPhotos = allPhotos;
    this.activeGalleryTab = 'all';
    this.activePhotoIndex = 0;

    const rawPrice = prop.priceSAR ?? prop.price;
    const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
    const formattedSARStr = (prop.priceFormattedSAR || '').toLowerCase();
    const isContactUs = !formattedSARStr || formattedSARStr.includes('تواصل معنا') || formattedSARStr.includes('اتصل بنا') || formattedSARStr.includes('contact') || formattedSARStr.includes('poa') || formattedSARStr.includes('application');
    const hasPrice = priceNum > 0 && !isContactUs;
    const budgetRanges = hasPrice ? generateDynamicBudgetRanges(priceNum) : [];

    const priceDisplayForWhatsApp = hasPrice ? prop.priceFormattedSAR : 'تواصل معنا';
    const whatsappMessage = encodeURIComponent(
      `Hello RETHA Real Estate,\n\nI am inquiring about the exclusive listing:\n"${prop.title}" (Ref: ${prop.id.toUpperCase()})\nPrice: ${priceDisplayForWhatsApp}\nLocation: ${prop.location}\n\nPlease share the confidential verification dossier and arrange a private VIP viewing.`
    );
    const whatsappUrl = `https://wa.me/966502125573?text=${whatsappMessage}`;

    content.innerHTML = `
      <!-- Mobile Floating Close Button -->
      <button class="modal-close-btn mobile-floating-close-btn" aria-label="Close dialog" title="Close dialog">&times;</button>

      <!-- Main Modal Grid: Responsive Two-Column Layout -->
      <div class="modal-body-grid grid grid-cols-1 lg:grid lg:grid-cols-2 lg:gap-8">
        
        <!-- Left Column: Image Carousel Showcase -->
        <div class="modal-showcase-column w-full">
          <!-- Gallery Category Tabs (Display all images by default) -->
          <div class="gallery-tabs-nav">
            <button class="gallery-tab-btn active" data-tab="all">All Photos (${allPhotos.length})</button>
            ${allExterior.length > 0 ? `<button class="gallery-tab-btn" data-tab="exterior">Exterior Views (${allExterior.length})</button>` : ''}
            ${allInterior.length > 0 ? `<button class="gallery-tab-btn" data-tab="interior">Interior Rooms (${allInterior.length})</button>` : ''}
            ${prop.gallery?.panorama360 ? `<button class="gallery-tab-btn highlight" data-tab="360"><span class="pulse-dot"></span> 360° Virtual Tour</button>` : ''}
            <button class="gallery-tab-btn" data-tab="specs">Specs & Title Deed</button>
            <button class="gallery-tab-btn" data-tab="calculator">Financial Plan</button>
          </div>

          <!-- Main Interactive Display Container -->
          <div class="gallery-viewport-wrapper w-full bg-transparent shadow-none border-none">
            <!-- 360 Panorama View (Hidden initially) -->
            <div id="modal-360-container" class="viewport-panel bg-transparent" style="display: none;">
              <div class="panorama-canvas-box"></div>
              <div class="panorama-overlay-hint">
                <span class="pan-icon">⇄</span> Drag to look 360° around Grand Salon • Scroll to zoom
              </div>
            </div>

            <!-- Standard Photo Viewer: Vertical stack (Main Image -> Caption Row -> Thumbnails) -->
            <div id="modal-photo-viewport" class="viewport-panel flex flex-col gap-4 bg-transparent">
              <!-- 1. Main Photo Container: 100% Clean and Unobstructed without overlays -->
              <div class="main-photo-stage relative w-full max-h-[58vh] overflow-hidden bg-transparent shadow-none border-none ${prop.status === 'sold' ? 'is-sold-stage' : ''}">
                <!-- Main Active Image: 100% visible and unobstructed -->
                <img id="main-active-photo" src="${this.currentPhotos[0]?.url || prop.mainImage}" alt="${prop.title}" class="active-photo-img object-contain w-full h-full max-h-[58vh] ${prop.status === 'sold' ? 'image-sold-dimmed' : ''}" quality="100" data-quality="100" decoding="async" />
                ${prop.status === 'sold' ? `
                  <div class="modal-sold-watermark-overlay">
                    <span class="sold-watermark-tag">🔒 TRANSACTION CONCLUDED • REGA ESCROW CONVEYED</span>
                  </div>
                ` : ''}

                <!-- Manual Navigation Arrows -->
                <button class="gallery-nav-arrow gallery-prev-arrow" aria-label="Previous Photo" title="Previous Photo">❮</button>
                <button class="gallery-nav-arrow gallery-next-arrow" aria-label="Next Photo" title="Next Photo">❯</button>
              </div>

              <!-- 2. Photo Caption & Auto-play Counter: In normal document flow, clean spot above thumbnails, NO dark gradient -->
              <div class="photo-info-bar">
                <div class="photo-info-left">
                  <h4 id="photo-caption-title">${this.currentPhotos[0]?.title || 'Main View'}</h4>
                  <p id="photo-caption-desc">${this.currentPhotos[0]?.desc || ''}</p>
                </div>
                <div class="gallery-counter-badge" title="Auto-playing slideshow (hover to pause)">
                  <span class="slideshow-pulse-indicator"></span>
                  <span id="gallery-current-idx">1</span> / <span id="gallery-total-count">${this.currentPhotos.length}</span>
                </div>
              </div>

              <!-- 3. Thumbnails Navigation Ribbon: Completely below the image in normal document flow -->
              <div class="photo-thumbnails-ribbon">
                ${this.renderThumbnails(this.currentPhotos)}
              </div>
            </div>

            <!-- Specs & Title Deed Panel -->
            <div id="modal-specs-viewport" class="viewport-panel" style="display: none;">
              <div class="specs-document-card">
                <div class="deed-header">
                  <div class="deed-seal">
                    <span class="seal-icon">⚜</span>
                    <div>
                      <h5>General Real Estate Authority Certified</h5>
                      <span class="deed-id">Official License: ${prop.regaLicense}</span>
                    </div>
                  </div>
                  <span class="verified-tag">Electronic Title Deed Verified</span>
                </div>
                <div class="specs-grid">
                  <div class="spec-tile">
                    <span class="tile-label">Electronic Title Deed #</span>
                    <span class="tile-val">${prop.deedNumber}</span>
                  </div>
                  <div class="spec-tile">
                    <span class="tile-label">Property Land Area</span>
                    <span class="tile-val highlight">${formatAreaWithUnit(prop.area) || prop.area}</span>
                  </div>
                  <div class="spec-tile">
                    <span class="tile-label">Built-Up Property Area (BUA)</span>
                    <span class="tile-val highlight">${formatAreaWithUnit(prop.builtUpArea) || prop.builtUpArea}</span>
                  </div>
                  <div class="spec-tile">
                    <span class="tile-label">Street Frontage</span>
                    <span class="tile-val">${prop.streetWidth}</span>
                  </div>
                  <div class="spec-tile">
                    <span class="tile-label">Orientation</span>
                    <span class="tile-val">${prop.orientation}</span>
                  </div>
                  <div class="spec-tile">
                    <span class="tile-label">Garage Capacity</span>
                    <span class="tile-val">${prop.garageCapacity}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Mortgage / Investment Calculator Panel -->
            <div id="modal-calc-viewport" class="viewport-panel" style="display: none;">
              <div class="calculator-card">
                <h4>Private Banking & Acquisition Estimator</h4>
                <p class="calc-sub">Indicative mortgage and financing breakdown based on prevailing Saudi prime lending rates.</p>
                <div class="calc-form-grid">
                  <div class="calc-field notranslate" translate="no">
                    <label>Property Price (SAR)</label>
                    <input type="text" id="calc-price" class="notranslate" translate="no" value="${hasPrice ? prop.priceSAR.toLocaleString() : 'تواصل معنا'}" disabled />
                  </div>
                  <div class="calc-field notranslate" translate="no">
                    <label>Down Payment (%)</label>
                    <select id="calc-downpayment" class="notranslate" translate="no" ${!hasPrice ? 'disabled' : ''}>
                      ${hasPrice ? `
                        <option value="0.2">20% Down Payment (SAR ${(prop.priceSAR * 0.2).toLocaleString()})</option>
                        <option value="0.3" selected>30% Down Payment (SAR ${(prop.priceSAR * 0.3).toLocaleString()})</option>
                        <option value="0.5">50% Down Payment (SAR ${(prop.priceSAR * 0.5).toLocaleString()})</option>
                      ` : `
                        <option value="0" selected>تواصل معنا</option>
                      `}
                    </select>
                  </div>
                  <div class="calc-field">
                    <label>Financing Tenure</label>
                    <select id="calc-tenure">
                      <option value="15">15 Years</option>
                      <option value="20" selected>20 Years</option>
                      <option value="25">25 Years</option>
                    </select>
                  </div>
                  <div class="calc-field">
                    <label>Estimated Murabaha / Profit Rate</label>
                    <input type="text" value="4.25% p.a." disabled />
                  </div>
                </div>
                <div class="calc-results-banner">
                  <div class="calc-result-item">
                    <span class="res-label">Est. Monthly Installment</span>
                    <span class="res-val" id="calc-monthly-val">Calculating...</span>
                  </div>
                  <div class="calc-result-item">
                    <span class="res-label">Financed Principal</span>
                    <span class="res-val" id="calc-loan-val">Calculating...</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Right Column: Property Particulars & VIP Broker Actions -->
        <div class="modal-info-column">
          <!-- Badges & Close Button Header: Professional tags at top of right column above title and price -->
          <div class="modal-header-top-row flex items-start justify-between gap-3 mb-4">
            <div class="modal-badges flex flex-wrap items-center gap-2">
              ${renderStatusBadgeHtml(prop.status, 'modal-status-badge')}
              <span class="luxury-badge gold"><i class="badge-icon">◆</i> ${prop.badge}</span>
              <span class="luxury-badge outline"><i class="badge-icon">✓</i> ${prop.regaLicense}</span>
              <span class="luxury-badge category">${prop.categoryLabel}</span>
            </div>
            <button class="modal-close-btn desktop-header-close-btn" aria-label="Close dialog" title="Close dialog">&times;</button>
          </div>

          <div class="property-meta-header">
            <div class="property-district-row">
              <span class="property-district"><i class="map-pin-icon">📍</i> ${prop.location}</span>
            </div>
            <h2 class="property-main-title">${prop.title}</h2>
            <p class="property-arabic-title">${prop.titleAr}</p>
          </div>

          <!-- Price Display -->
          ${hasPrice ? `
            <div class="property-pricing-box notranslate" translate="no">
              <div class="price-sar notranslate">${prop.priceFormattedSAR}</div>
              <div class="price-usd notranslate">${prop.priceFormattedUSD}</div>
            </div>
          ` : `
            <div class="property-pricing-box is-contact-pricing notranslate" translate="no">
              <div class="price-sar notranslate price-contact-text" translate="no" dir="rtl">تواصل معنا</div>
            </div>
          `}

          <!-- Quick Stats Pills -->
          <div class="property-stats-ribbon">
            ${prop.bedrooms > 0 ? `<div class="stat-pill"><span class="icon">🛏</span> ${prop.bedrooms} Bed</div>` : ''}
            ${prop.bathrooms > 0 ? `<div class="stat-pill"><span class="icon">🛁</span> ${prop.bathrooms} Bath</div>` : ''}
            <div class="stat-pill"><span class="icon">📐</span> ${formatAreaWithUnit(prop.area) || prop.area}</div>
            <div class="stat-pill"><span class="icon">🚗</span> ${prop.garageCapacity}</div>
          </div>

          <!-- Editorial Description -->
          <div class="property-description-body">
            <p>${prop.description}</p>
          </div>

          <!-- Luxury Inclusions List -->
          <div class="property-amenities-section">
            <h5>Curated Inclusions & Infrastructure</h5>
            <ul class="amenities-checklist">
              ${prop.amenities.map(a => `<li><span class="check-icon">✓</span> ${a}</li>`).join('')}
            </ul>
          </div>

          <!-- Dynamic Lead / Waitlist / Sold Interface -->
          ${prop.status === 'sold' ? `
            <div class="modal-lead-form-box modal-sold-lead-box">
              <div class="modal-sold-concluded-card">
                <div class="sold-badge-pill">
                  <span class="sold-pill-dot"></span>
                  <span>OFFICIALLY SOLD & CONVEYED</span>
                </div>
                <h4 class="sold-concluded-title">This Asset Has Been Acquired</h4>
                <div class="sold-concluded-reg">Electronic Title Deed Conveyance Finalized Under REGA License</div>
                <p class="sold-concluded-desc">
                  Direct acquisition for <strong>${prop.title}</strong> is now concluded and the title deed has transferred. However, our accredited advisory desk maintains verified off-market portfolios and upcoming private releases matching this exact architectural profile in ${prop.district}.
                </p>

                <div class="sold-concluded-buttons">
                  <button class="btn-primary-luxury full-width btn-modal-view-similar" data-category="${prop.category}">
                    <span>View Similar Available Properties</span>
                    <span class="btn-arrow">→</span>
                  </button>
                  <button class="btn-secondary-luxury full-width btn-modal-waitlist-offmarket" data-id="${prop.id}">
                    <span>Inquire for Off-Market Portfolios</span>
                  </button>
                </div>
              </div>
            </div>
          ` : `
            ${this.renderInquiryFormHtml(prop)}
          `}

          <!-- Official Guarantee Note -->
          <div class="official-security-note">
            <span class="shield-icon">🛡</span>
            <span>Accredited transaction handled under General Real Estate Authority regulatory framework with authenticated escrow title conveyance.</span>
          </div>

        </div>
      </div>
    `;

    this.bindModalEvents(prop);
    this.updateMortgageCalculation(prop.priceSAR);
  }

  renderThumbnails(photos) {
    return photos.map((p, idx) => `
      <button class="thumb-btn ${idx === 0 ? 'active' : ''}" data-index="${idx}">
        <img src="${p.url}" alt="${p.title}" loading="lazy" />
        <span class="thumb-label">${p.title}</span>
      </button>
    `).join('');
  }

  bindModalEvents(prop) {
    const content = this.modalEl.querySelector('.modal-inner-container');
    const closeBtns = content.querySelectorAll('.modal-close-btn');
    closeBtns.forEach(btn => btn.addEventListener('click', () => this.close()));

    // Manual Arrow Navigation for Gallery
    const prevBtn = content.querySelector('.gallery-prev-arrow');
    const nextBtn = content.querySelector('.gallery-next-arrow');
    if (prevBtn) prevBtn.addEventListener('click', (e) => { e.stopPropagation(); this.prevPhoto(true); });
    if (nextBtn) nextBtn.addEventListener('click', (e) => { e.stopPropagation(); this.nextPhoto(true); });

    // Pause auto-advancing slideshow on hover so user can inspect details
    const photoStage = content.querySelector('.gallery-viewport-wrapper');
    if (photoStage) {
      photoStage.addEventListener('mouseenter', () => { this.isAutoPlayPaused = true; });
      photoStage.addEventListener('mouseleave', () => { this.isAutoPlayPaused = false; });
    }

    // Tabs switching
    const tabBtns = content.querySelectorAll('.gallery-tab-btn');
    const photoViewport = content.querySelector('#modal-photo-viewport');
    const panoramaContainer = content.querySelector('#modal-360-container');
    const specsViewport = content.querySelector('#modal-specs-viewport');
    const calcViewport = content.querySelector('#modal-calc-viewport');

    tabBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        soundEngine.playClick();
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const tab = btn.dataset.tab;
        this.activeGalleryTab = tab;

        // Hide all viewports
        photoViewport.style.display = 'none';
        panoramaContainer.style.display = 'none';
        specsViewport.style.display = 'none';
        calcViewport.style.display = 'none';

        if (this.panoramaViewer) {
          this.panoramaViewer.destroy();
          this.panoramaViewer = null;
        }

        if (tab === 'all' || tab === 'exterior' || tab === 'interior') {
          photoViewport.style.display = 'flex';
          const allPhotos = (prop.images && prop.images.length > 0)
            ? prop.images
            : (prop.gallery?.all && prop.gallery.all.length > 0)
              ? prop.gallery.all
              : [...(prop.gallery?.exterior || []), ...(prop.gallery?.interior || [])];
          const allExterior = prop.gallery?.exterior || [];
          const allInterior = prop.gallery?.interior || [];

          if (tab === 'all') {
            this.currentPhotos = allPhotos;
          } else if (tab === 'exterior') {
            this.currentPhotos = allExterior.length > 0 ? allExterior : allPhotos;
          } else {
            this.currentPhotos = allInterior.length > 0 ? allInterior : allPhotos;
          }

          this.activePhotoIndex = 0;
          this.updateActivePhoto();
          const ribbon = content.querySelector('.photo-thumbnails-ribbon');
          if (ribbon) ribbon.innerHTML = this.renderThumbnails(this.currentPhotos);
          const totalEl = content.querySelector('#gallery-total-count');
          if (totalEl) totalEl.textContent = this.currentPhotos.length;
          this.bindThumbnailClicks();
          this.syncThumbnails();
          this.startAutoPlay();
        } else {
          this.stopAutoPlay();
          if (tab === '360') {
            panoramaContainer.style.display = 'block';
            const canvasBox = panoramaContainer.querySelector('.panorama-canvas-box');
            if (canvasBox && prop.gallery.panorama360) {
              this.panoramaViewer = new PanoramaViewer(canvasBox, prop.gallery.panorama360);
            }
          } else if (tab === 'specs') {
            specsViewport.style.display = 'block';
          } else if (tab === 'calculator') {
            calcViewport.style.display = 'block';
          }
        }
      });
    });

    this.bindThumbnailClicks();

    // Mortgage calculator inputs
    const downSelect = content.querySelector('#calc-downpayment');
    const tenureSelect = content.querySelector('#calc-tenure');
    if (downSelect) downSelect.addEventListener('change', () => this.updateMortgageCalculation(prop.priceSAR));
    if (tenureSelect) tenureSelect.addEventListener('change', () => this.updateMortgageCalculation(prop.priceSAR));

    // Schedule viewing button
    const scheduleBtn = content.querySelector('.btn-schedule-viewing');
    if (scheduleBtn) {
      scheduleBtn.addEventListener('click', () => {
        this.openViewingScheduler(prop);
      });
    }

    // Sold Property: "View Similar Available Properties" click listener
    const viewSimilarBtn = content.querySelector('.btn-modal-view-similar');
    if (viewSimilarBtn) {
      viewSimilarBtn.addEventListener('click', (e) => {
        e.preventDefault();
        soundEngine.playClick();
        this.close();
        window.dispatchEvent(new CustomEvent('retha:view-similar', { detail: { property: prop } }));
      });
    }

    // Sold Property: "Request Off-Market Sourcing" click listener
    const sourcingBtn = content.querySelector('.btn-modal-waitlist-offmarket');
    if (sourcingBtn) {
      sourcingBtn.addEventListener('click', (e) => {
        e.preventDefault();
        soundEngine.playClick();
        this.close();
        window.dispatchEvent(new CustomEvent('retha:open-waitlist', { detail: { property: prop } }));
      });
    }

    // Bind reusable inquiry form inside dossier layout
    this.bindInquiryForm(content, prop, () => this.close());
  }

  startAutoPlay() {
    this.stopAutoPlay();
    if (!this.currentPhotos || this.currentPhotos.length <= 1) return;
    if (this.activeGalleryTab !== 'all' && this.activeGalleryTab !== 'exterior' && this.activeGalleryTab !== 'interior') return;

    this.autoPlayTimer = setInterval(() => {
      if (!this.isAutoPlayPaused && this.modalEl && this.modalEl.classList.contains('active')) {
        this.nextPhoto(false);
      }
    }, this.autoPlayInterval);
  }

  stopAutoPlay() {
    if (this.autoPlayTimer) {
      clearInterval(this.autoPlayTimer);
      this.autoPlayTimer = null;
    }
  }

  nextPhoto(isManual = true) {
    if (!this.currentPhotos || this.currentPhotos.length <= 1) return;
    this.activePhotoIndex = (this.activePhotoIndex + 1) % this.currentPhotos.length;
    this.updateActivePhoto();
    this.syncThumbnails();
    if (isManual) {
      soundEngine.playClick();
      this.startAutoPlay();
    }
  }

  prevPhoto(isManual = true) {
    if (!this.currentPhotos || this.currentPhotos.length <= 1) return;
    this.activePhotoIndex = (this.activePhotoIndex - 1 + this.currentPhotos.length) % this.currentPhotos.length;
    this.updateActivePhoto();
    this.syncThumbnails();
    if (isManual) {
      soundEngine.playClick();
      this.startAutoPlay();
    }
  }

  syncThumbnails() {
    const thumbs = this.modalEl.querySelectorAll('.thumb-btn');
    const ribbon = this.modalEl.querySelector('.photo-thumbnails-ribbon');

    thumbs.forEach((thumb, idx) => {
      const isActive = idx === this.activePhotoIndex;
      thumb.classList.toggle('active', isActive);
      if (isActive && ribbon) {
        // Horizontally center the active thumbnail strictly within the ribbon container.
        // Avoid using thumb.scrollIntoView() which forces vertical scrolling on parent
        // containers (like modal-inner-container), pulling mobile users back to the top.
        const scrollTarget = thumb.offsetLeft - (ribbon.clientWidth / 2) + (thumb.clientWidth / 2);
        ribbon.scrollTo({ left: scrollTarget, behavior: 'smooth' });
      }
    });

    const currentIdxEl = this.modalEl.querySelector('#gallery-current-idx');
    if (currentIdxEl) {
      currentIdxEl.textContent = this.activePhotoIndex + 1;
    }
  }

  bindThumbnailClicks() {
    const thumbs = this.modalEl.querySelectorAll('.thumb-btn');
    thumbs.forEach(thumb => {
      thumb.addEventListener('click', () => {
        soundEngine.playClick();
        this.activePhotoIndex = parseInt(thumb.dataset.index || 0, 10);
        this.updateActivePhoto();
        this.syncThumbnails();
        this.startAutoPlay();
      });
    });
  }

  updateActivePhoto() {
    const photo = this.currentPhotos[this.activePhotoIndex];
    if (!photo) return;
    const imgEl = this.modalEl.querySelector('#main-active-photo');
    const backdropEl = this.modalEl.querySelector('.photo-stage-backdrop');
    const titleEl = this.modalEl.querySelector('#photo-caption-title');
    const descEl = this.modalEl.querySelector('#photo-caption-desc');
    const currentIdxEl = this.modalEl.querySelector('#gallery-current-idx');

    if (imgEl) {
      imgEl.classList.add('is-fading');
      setTimeout(() => {
        imgEl.src = photo.url;
        imgEl.classList.remove('is-fading');
        if (backdropEl) {
          backdropEl.style.backgroundImage = `url('${photo.url}')`;
        }
      }, 160);
    }
    if (titleEl) titleEl.textContent = photo.title;
    if (descEl) descEl.textContent = photo.desc || '';
    if (currentIdxEl) currentIdxEl.textContent = this.activePhotoIndex + 1;
  }

  updateMortgageCalculation(price) {
    if (!price || price <= 0) {
      const monthlyEl = document.querySelector('#calc-monthly-val');
      const loanEl = document.querySelector('#calc-loan-val');
      if (monthlyEl) monthlyEl.textContent = 'تواصل معنا';
      if (loanEl) loanEl.textContent = 'تواصل معنا';
      return;
    }

    const downPct = parseFloat(document.querySelector('#calc-downpayment')?.value || 0.3);
    const tenureYears = parseInt(document.querySelector('#calc-tenure')?.value || 20, 10);
    const profitRateAnnual = 0.0425;

    const loanAmount = price * (1 - downPct);
    const totalMonths = tenureYears * 12;
    const monthlyRate = profitRateAnnual / 12;

    // Monthly installment formula
    const monthlyPayment = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, totalMonths)) / (Math.pow(1 + monthlyRate, totalMonths) - 1);

    const monthlyEl = document.querySelector('#calc-monthly-val');
    const loanEl = document.querySelector('#calc-loan-val');

    if (monthlyEl) monthlyEl.textContent = `SAR ${Math.round(monthlyPayment).toLocaleString()} / mo`;
    if (loanEl) loanEl.textContent = `SAR ${Math.round(loanAmount).toLocaleString()}`;
  }

  openViewingScheduler(prop) {
    const schedulerModal = document.querySelector('#schedule-viewing-modal');
    if (schedulerModal) {
      schedulerModal.dataset.propertyId = prop?.dbId || prop?.id || '';
      schedulerModal.querySelector('#schedule-prop-name').textContent = prop?.title || 'General VIP Private Acquisition Advisory';
      schedulerModal.classList.add('active');
      document.body.style.overflow = 'hidden';
    }
  }

  /**
   * Reusable Smart Inquiry Form HTML Generator
   * Retains smart dynamic logic:
   * - Hides budget allocation for unpriced/Contact Us properties
   * - Displays dynamic budget ranges for priced properties
   * - Preserves identical fields, pills, and dark luxury styling
   */
  renderInquiryFormHtml(prop) {
    const isAr = getLanguage() === 'ar';
    const rawPrice = prop.priceSAR ?? prop.price;
    const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
    const formattedSARStr = (prop.priceFormattedSAR || '').toLowerCase();
    const isContactUs = !formattedSARStr || formattedSARStr.includes('تواصل معنا') || formattedSARStr.includes('اتصل بنا') || formattedSARStr.includes('contact') || formattedSARStr.includes('poa') || formattedSARStr.includes('application');
    const hasPrice = priceNum > 0 && !isContactUs;
    const budgetRanges = hasPrice ? generateDynamicBudgetRanges(priceNum) : [];

    const labelFullName = isAr ? 'الاسم الكامل *' : 'Full Name *';
    const phFullName = isAr ? 'الاسم الكريم' : 'Full Name';
    const labelPhone = isAr ? 'رقم الجوال *' : 'Mobile Number *';
    const labelEmail = isAr ? 'البريد الإلكتروني (اختياري)' : 'Email Address (Optional)';
    const labelBudget = isAr ? 'الميزانية التقديرية' : 'Budget Allocation';
    const labelMethod = isAr ? 'وسيلة التواصل المفضلة' : 'Preferred Contact Channel';
    const labelPhoneBtn = isAr ? '✆ اتصال هاتفي' : '✆ Phone Call';
    const labelWaBtn = isAr ? '💬 واتساب' : '💬 WhatsApp';
    const labelEmailBtn = isAr ? '✉ بريد إلكتروني' : '✉ Email';
    const labelNotes = prop.status === 'reserved'
      ? (isAr ? 'ملاحظات قائمة الانتظار / الجاهزية المالية' : 'Waitlist Notes / Acquisition Readiness')
      : (isAr ? 'استفسارات خاصة أو متطلبات معاينة' : 'Specific Requests or Inquiries');
    const phNotes = prop.status === 'reserved'
      ? (isAr ? 'مثال: جاهز للإفراغ الفوري والشراء النقدي...' : 'e.g. Prepared for immediate cash closing if reservation opens...')
      : (isAr ? 'مثال: استفسار عن الصك الإلكتروني، موعد معاينة خاصة...' : 'e.g. Inquire on electronic title deed, schedule private viewing...');
    const btnSubmitText = prop.status === 'reserved'
      ? (isAr ? 'تأكيد الانضمام لقائمة الانتظار' : 'Join Priority Waitlist')
      : (isAr ? 'إرسال طلب الاستفسار الخاص' : 'Submit Acquisition Request');

    const kicker = prop.status === 'reserved'
      ? (isAr ? 'سجل قائمة الانتظار ذات الأولوية' : 'PRIORITY WAITLIST REGISTRY')
      : (isAr ? 'طلب استفسار سري وموثق' : 'CONFIDENTIAL INQUIRY');
    const title = prop.status === 'reserved'
      ? (isAr ? 'الانضمام لقائمة انتظار العقار المحجوز' : 'Join Reserved Asset Priority Waitlist')
      : (isAr ? 'طلب ملف العقار وحجز موعد معاينة خاصة' : 'Request Property Dossier & Acquisition Inspection');
    const sub = prop.status === 'reserved'
      ? (isAr ? 'إشعار مباشر وفوري في حال عدم إتمام اتفاقية الحجز الحالية' : 'Direct notification if the current reservation agreement lapses')
      : (isAr ? 'تحويل مباشر لمستشاري ريثا العقاريين المعتمدين برخصة فال' : 'Direct transmission to accredited RETHA asset managers');

    return `
      <div class="modal-lead-form-box ${prop.status === 'reserved' ? 'modal-reserved-lead-box' : ''}">
        ${prop.status === 'reserved' ? `
          <div class="modal-reserved-notice-card">
            <div class="reserved-notice-icon">⏳</div>
            <div class="reserved-notice-text">
              <strong>${isAr ? 'حجز عميل نشط قيد الإجراء' : 'Active Client Reservation in Progress'}</strong>
              <p>${isAr ? 'تم إيداع عربون حجز رسمي على هذا الأصل. انضم لقائمة الانتظار الموثقة لتلقي أولوية الشراء الفورية في حال عدم إتمام الصفقة.' : 'A formal reservation deposit has been placed on this asset. Join the verified priority waitlist below to receive instant 1st-right notification if this transaction does not complete.'}</p>
            </div>
          </div>
        ` : ''}

        <div class="lead-box-header">
          <span class="lead-box-kicker">${kicker}</span>
          <h5 class="lead-box-title">${title}</h5>
          <span class="lead-box-sub">${sub}</span>
        </div>

        <form class="modal-inquiry-form" data-prop-id="${prop.id}">
          <div class="modal-form-row">
            <div class="modal-form-field">
              <label>${labelFullName}</label>
              <input type="text" class="inq-name" placeholder="${phFullName}" required />
            </div>
            <div class="modal-form-field">
              <label>${labelPhone}</label>
              <input type="tel" class="inq-phone" placeholder="+966 50 XXX XXXX" required />
            </div>
          </div>

          <div class="modal-form-row ${!hasPrice ? 'single-col' : ''}">
            <div class="modal-form-field">
              <label>${labelEmail}</label>
              <input type="email" class="inq-email" placeholder="name@domain.com" />
            </div>
            ${hasPrice && budgetRanges.length > 0 ? `
              <div class="modal-form-field notranslate" translate="no">
                <label>${labelBudget}</label>
                <select class="inq-budget notranslate" translate="no">
                  ${budgetRanges.map(r => `
                    <option value="${r.value}" ${r.selected ? 'selected' : ''}>${r.label}</option>
                  `).join('')}
                </select>
              </div>
            ` : ''}
          </div>

          <div class="modal-form-field">
            <label>${labelMethod}</label>
            <div class="inq-method-pills">
              <button type="button" class="inq-method-btn active" data-method="Phone">${labelPhoneBtn}</button>
              <button type="button" class="inq-method-btn" data-method="WhatsApp">${labelWaBtn}</button>
              <button type="button" class="inq-method-btn" data-method="Email">${labelEmailBtn}</button>
            </div>
            <input type="hidden" class="inq-selected-method" value="Phone" />
          </div>

          <div class="modal-form-field">
            <label>${labelNotes}</label>
            <input type="text" class="inq-notes" placeholder="${phNotes}" />
          </div>

          <button type="submit" class="btn-primary-luxury full-width ${prop.status === 'reserved' ? 'btn-waitlist-accent' : ''}">
            <span>${btnSubmitText}</span>
            <span class="btn-arrow">→</span>
          </button>
        </form>

        <!-- Success Confirmation Screen -->
        <div class="modal-inquiry-success" style="display: none;">
          <div class="success-icon-mini">✓</div>
          <h5>${prop.status === 'reserved' ? (isAr ? 'تم تسجيلك في قائمة الانتظار' : 'Priority Waitlist Logged') : (isAr ? 'تم تسجيل طلبك بنجاح' : 'Inquiry Successfully Logged')}</h5>
          <div class="modal-ref-tag">Ref: <span class="modal-ref-code">RE-882194</span></div>
          <p class="modal-success-desc"></p>
          <button type="button" class="btn-secondary-luxury modal-inquiry-done-btn" style="margin-top: 16px; width: 100%;">${isAr ? 'تم' : 'Done'}</button>
        </div>
      </div>
    `;
  }

  /**
   * Reusable Form Logic and Submission Handler
   * Saves to Supabase leads table (triggering Telegram notification)
   * and saves to localStorage
   */
  bindInquiryForm(container, prop, onDone) {
    if (!container) return;

    // Contact method pill toggles inside modal
    const methodBtns = container.querySelectorAll('.inq-method-btn');
    const methodInput = container.querySelector('.inq-selected-method');
    methodBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        soundEngine.playClick();
        methodBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        if (methodInput) methodInput.value = btn.dataset.method;
      });
    });

    // Inquiry form submission
    const inquiryForm = container.querySelector('.modal-inquiry-form');
    if (inquiryForm) {
      inquiryForm.addEventListener('submit', (e) => {
        e.preventDefault();
        soundEngine.playClick();

        const name = inquiryForm.querySelector('.inq-name')?.value.trim() || 'Valued Client';
        const phone = inquiryForm.querySelector('.inq-phone')?.value.trim() || 'N/A';
        const email = inquiryForm.querySelector('.inq-email')?.value.trim() || 'Not Provided';
        const rawPrice = prop.priceSAR ?? prop.price;
        const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
        const formattedSARStr = (prop.priceFormattedSAR || '').toLowerCase();
        const isContactUs = !formattedSARStr || formattedSARStr.includes('تواصل معنا') || formattedSARStr.includes('اتصل بنا') || formattedSARStr.includes('contact') || formattedSARStr.includes('poa') || formattedSARStr.includes('application');
        const hasPrice = priceNum > 0 && !isContactUs;
        const budget = hasPrice ? (inquiryForm.querySelector('.inq-budget')?.value || prop.priceFormattedSAR) : null;
        const method = methodInput?.value || 'Phone';
        const notes = inquiryForm.querySelector('.inq-notes')?.value.trim() || 'No additional notes';

        const leadRef = 'RE-' + Math.floor(100000 + Math.random() * 900000);
        const timestamp = new Date().toLocaleString('en-US', {
          timeZone: 'Asia/Riyadh',
          dateStyle: 'medium',
          timeStyle: 'short'
        });

        const leadData = {
          ref: leadRef,
          timestamp,
          name,
          phone,
          email,
          propertyId: prop.id,
          propertyName: prop.title,
          propertyStatus: prop.status,
          leadType: prop.status === 'reserved' ? 'WAITLIST' : 'INQUIRY',
          budget: budget || 'POA / Contact Us',
          preferredContactMethod: method,
          notes,
          status: prop.status === 'reserved' ? 'WAITLIST' : 'NEW'
        };

        try {
          const raw = localStorage.getItem('retha_client_inquiries');
          const list = raw ? JSON.parse(raw) : [];
          list.unshift(leadData);
          localStorage.setItem('retha_client_inquiries', JSON.stringify(list));

          const badge = document.querySelector('#agency-leads-count-badge');
          if (badge) {
            badge.textContent = list.length;
            badge.style.display = 'inline-block';
          }
        } catch (err) {
          console.error('Storage error', err);
        }

        // Save lead to Supabase database so Postgres trigger fires notify-new-lead
        (async () => {
          try {
            const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
            let propertyUuid = null;
            if (prop) {
              if (prop.dbId && isUuid.test(prop.dbId)) {
                propertyUuid = prop.dbId;
              } else if (prop.id && isUuid.test(prop.id)) {
                propertyUuid = prop.id;
              }
            }

            let methodCode = 'phone';
            const m = (method || '').toLowerCase();
            if (m.includes('whatsapp') || m.includes('واتساب')) {
              methodCode = 'whatsapp';
            } else if (m.includes('email') || m.includes('إيميل') || m.includes('بريد')) {
              methodCode = 'email';
            }

            const { error: dbErr } = await supabase.from('leads').insert({
              full_name: name,
              phone: phone,
              email: email && email !== 'Not Provided' ? email : null,
              property_id: propertyUuid,
              preferred_contact_method: methodCode,
              budget_range: budget || null,
              message: notes || null,
              status: 'new'
            });

            if (dbErr) {
              console.error('Supabase leads insert error:', dbErr);
            }
          } catch (e) {
            console.error('Failed to insert lead into Supabase:', e);
          }
        })();

        // Show confirmation view
        inquiryForm.style.display = 'none';
        const successBox = container.querySelector('.modal-inquiry-success');
        if (successBox) {
          successBox.style.display = 'block';
          const refEl = successBox.querySelector('.modal-ref-code');
          const descEl = successBox.querySelector('.modal-success-desc');

          if (refEl) refEl.textContent = leadRef;
          if (descEl) {
            if (prop.status === 'reserved') {
              descEl.innerHTML = `
                Thank you, <strong>${name}</strong>. You have been placed on the <strong>Priority Waitlist</strong> for <strong>${prop.title}</strong>. If the current reservation agreement lapses, our certified advisory team will immediately contact you via <strong>${method}</strong> at <strong>${phone}</strong>.
              `;
            } else {
              descEl.innerHTML = `
                Thank you, <strong>${name}</strong>. Your inquiry for <strong>${prop.title}</strong> has been prioritized. Our certified real estate advisor will connect with you via <strong>${method}</strong> at <strong>${phone}</strong>.
              `;
            }
          }
        }
      });
    }

    // Done button on inquiry success screen
    const doneBtn = container.querySelector('.modal-inquiry-done-btn');
    if (doneBtn) {
      doneBtn.addEventListener('click', () => {
        soundEngine.playClick();
        if (typeof onDone === 'function') {
          onDone();
        } else {
          this.close();
        }
      });
    }
  }

  /**
   * Standalone Smart Property Inquiry Pop-up Modal ("REQUEST INFO")
   * Reuses the exact same form component without property images.
   */
  openInquiryModal(prop) {
    if (!prop) return;
    const inquiryModal = document.querySelector('#property-inquiry-modal');
    if (!inquiryModal) return;

    soundEngine.playSwoosh();

    const rawPrice = prop.priceSAR ?? prop.price;
    const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
    const formattedSARStr = (prop.priceFormattedSAR || '').toLowerCase();
    const isContactUs = !formattedSARStr || formattedSARStr.includes('تواصل معنا') || formattedSARStr.includes('اتصل بنا') || formattedSARStr.includes('contact') || formattedSARStr.includes('poa') || formattedSARStr.includes('application');
    const hasPrice = priceNum > 0 && !isContactUs;

    const isAr = getLanguage() === 'ar';
    const mainTitle = isAr ? (prop.titleAr || prop.title) : prop.title;
    const subTitle = isAr ? prop.title : (prop.titleAr || '');
    const locationText = isAr ? (prop.locationAr || prop.location) : prop.location;
    const priceText = hasPrice ? prop.priceFormattedSAR : (isAr ? 'تواصل معنا' : 'Price on Request');
    const securityNote = isAr
      ? 'معاملة معتمدة تتم تحت المظلة التنظيمية للهيئة العامة للعقار مع توثيق وإفراغ الصكوك الإلكترونية الرسمية.'
      : 'Accredited transaction handled under General Real Estate Authority regulatory framework with authenticated escrow title conveyance.';

    const dialog = inquiryModal.querySelector('.property-inquiry-dialog');
    if (!dialog) return;

    dialog.innerHTML = `
      <button class="modal-close-icon inq-modal-close-btn" aria-label="Close dialog">&times;</button>
      
      <div class="inquiry-modal-header">
        <div class="flex items-center gap-2 mb-2">
          ${renderStatusBadgeHtml(prop.status, 'modal-status-badge')}
          <span class="luxury-badge gold"><i class="badge-icon">◆</i> ${prop.badge || (isAr ? 'موثق' : 'Verified')}</span>
          <span class="luxury-badge outline"><i class="badge-icon">✓</i> ${isAr ? 'معتمد من الهيئة' : 'REGA Certified'}</span>
        </div>
        <h3 class="inquiry-modal-title">${mainTitle}</h3>
        <p class="inquiry-modal-arabic-sub">${subTitle}</p>
        <div class="inquiry-modal-meta-row">
          <span class="meta-location">📍 ${locationText}</span>
          <span class="meta-price ${!hasPrice ? 'is-contact-price' : ''}">${priceText}</span>
        </div>
      </div>

      ${this.renderInquiryFormHtml(prop)}

      <div class="official-security-note" style="margin-top: 20px;">
        <span class="shield-icon">🛡</span>
        <span>${securityNote}</span>
      </div>
    `;

    inquiryModal.classList.add('active');
    document.body.style.overflow = 'hidden';

    // Bind form events for this standalone modal
    this.bindInquiryForm(dialog, prop, () => {
      this.closeInquiryModal();
    });

    // Close buttons inside dialog
    const closeBtns = inquiryModal.querySelectorAll('.inq-modal-close-btn, .inq-modal-close-trigger');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        soundEngine.playClick();
        this.closeInquiryModal();
      });
    });
  }

  closeInquiryModal() {
    const inquiryModal = document.querySelector('#property-inquiry-modal');
    if (inquiryModal) {
      inquiryModal.classList.remove('active');
      document.body.style.overflow = '';
    }
  }
}
