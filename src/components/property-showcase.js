import { properties, renderStatusBadgeHtml, formatAreaWithUnit } from '../data/properties.js';
import { soundEngine } from './audio-controller.js';
import { statusToast } from './status-toast.js';
import { sanitizePlainText, debounce } from '../utils/security.js';
import { t, getLanguage } from '../i18n/i18n.js';

export class PropertyShowcase {
  constructor(propertyModal, leadCapture) {
    this.modal = propertyModal;
    this.leadCapture = leadCapture;
    this.container = document.querySelector('#properties-grid');
    this.filterCategory = 'all';
    this.searchQuery = '';
    this.maxPrice = 150000000;
    this.currency = 'SAR'; // or 'USD'
    this.filteredList = [...properties];

    this.init();
  }

  init() {
    this.render();
    this.bindFilters();
    this.bindCardInteractions();
    this.bindGlobalEvents();
  }

  bindGlobalEvents() {
    // Listen for live data / status model updates
    window.addEventListener('retha:properties-changed', () => {
      this.applyFilters();
    });

    // Listen for language changes and re-render dynamic cards
    window.addEventListener('retha:lang-changed', () => {
      this.applyFilters();
    });

    // Listen for view similar requests from modal or toasts
    window.addEventListener('retha:view-similar', (e) => {
      const prop = e.detail?.property;
      if (prop) this.handleViewSimilar(prop);
    });

    // Listen for waitlist modal requests
    window.addEventListener('retha:open-waitlist', (e) => {
      const prop = e.detail?.property;
      if (prop) {
        this.modal.openInquiryModal(prop);
      }
    });

    // Listen for property inspection requests
    window.addEventListener('retha:open-property', (e) => {
      const id = e.detail?.id;
      if (id) this.modal.open(id);
    });
  }

  bindFilters() {
    // Category pills
    const pills = document.querySelectorAll('.category-filter-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        soundEngine.playClick();
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        this.filterCategory = pill.dataset.category;
        this.applyFilters();
      });
    });

    // Search bar input with security sanitization & resilient debouncing
    const searchInput = document.querySelector('#property-search-input');
    if (searchInput) {
      const debouncedSearch = debounce((val) => {
        this.searchQuery = sanitizePlainText(val).toLowerCase().trim();
        this.applyFilters();
      }, 150);

      searchInput.addEventListener('input', (e) => {
        debouncedSearch(e.target.value);
      });
    }

    // Price range slider
    const priceSlider = document.querySelector('#price-range-slider');
    const priceDisplay = document.querySelector('#price-range-display');
    if (priceSlider && priceDisplay) {
      priceSlider.addEventListener('input', (e) => {
        this.maxPrice = parseInt(e.target.value, 10);
        priceDisplay.textContent = `Up to SAR ${(this.maxPrice / 1000000).toFixed(0)}M`;
        this.applyFilters();
      });
    }

    // Currency toggle (SAR / USD)
    const currencyToggle = document.querySelector('#currency-toggle-btn');
    if (currencyToggle) {
      currencyToggle.addEventListener('click', () => {
        soundEngine.playClick();
        this.currency = this.currency === 'SAR' ? 'USD' : 'SAR';
        currencyToggle.textContent = this.currency === 'SAR' ? 'Currency: SAR' : 'Currency: USD';
        this.render();
        this.bindCardInteractions();
      });
    }

    // Reset filters button
    const resetBtn = document.querySelector('#reset-filters-btn');
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        soundEngine.playClick();
        this.filterCategory = 'all';
        this.searchQuery = '';
        this.maxPrice = 150000000;
        pills.forEach(p => p.classList.toggle('active', p.dataset.category === 'all'));
        if (searchInput) searchInput.value = '';
        if (priceSlider) priceSlider.value = 150000000;
        if (priceDisplay) priceDisplay.textContent = 'Up to SAR 150M';
        this.applyFilters();
      });
    }
  }

  applyFilters() {
    this.filteredList = properties.filter(prop => {
      // Category filter
      if (this.filterCategory !== 'all' && prop.category !== this.filterCategory) {
        return false;
      }
      // Price filter
      if (prop.priceSAR > this.maxPrice) {
        return false;
      }
      // Search query
      if (this.searchQuery) {
        const matchTitle = prop.title.toLowerCase().includes(this.searchQuery);
        const matchTitleAr = prop.titleAr.includes(this.searchQuery);
        const matchLoc = prop.location.toLowerCase().includes(this.searchQuery);
        const matchDistrict = prop.district.toLowerCase().includes(this.searchQuery);
        const matchBadge = prop.badge.toLowerCase().includes(this.searchQuery);
        const matchStatus = prop.status.toLowerCase().includes(this.searchQuery);
        if (!matchTitle && !matchTitleAr && !matchLoc && !matchDistrict && !matchBadge && !matchStatus) {
          return false;
        }
      }
      return true;
    });

    // Update counter
    const counterEl = document.querySelector('#results-counter-badge');
    if (counterEl) {
      const isAr = getLanguage() === 'ar';
      counterEl.textContent = isAr
        ? `عرض ${this.filteredList.length} من أصل ${properties.length} أصل موثق`
        : `Showing ${this.filteredList.length} of ${properties.length} Verified Assets`;
    }

    this.render();
    this.bindCardInteractions();
  }

  render() {
    if (!this.container) return;

    const isAr = getLanguage() === 'ar';

    if (this.filteredList.length === 0) {
      this.container.innerHTML = `
        <div class="no-properties-state">
          <div class="empty-icon">⚜</div>
          <h3>${t('no_props_title', 'No Exclusive Portfolios Found')}</h3>
          <p>${t('no_props_desc', 'Please adjust your price threshold or category filter to view matching verified listings.')}</p>
          <button id="reset-empty-btn" class="btn-primary-luxury">${t('reset_all_filters', 'Reset All Filters')}</button>
        </div>
      `;
      const resetBtn = this.container.querySelector('#reset-empty-btn');
      if (resetBtn) {
        resetBtn.addEventListener('click', () => {
          document.querySelector('#reset-filters-btn')?.click();
        });
      }
      return;
    }

    this.container.innerHTML = this.filteredList.map((prop, idx) => {
      const rawPrice = prop.priceSAR ?? prop.price;
      const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
      const hasPrice = priceNum > 0;
      const displayPrice = hasPrice
        ? (this.currency === 'SAR' ? prop.priceFormattedSAR : prop.priceFormattedUSD)
        : t('price_contact_us', 'تواصل معنا');
      const isSold = prop.status === 'sold';
      const isReserved = prop.status === 'reserved';

      // Bilingual titles and locations
      const mainTitle = isAr ? (prop.titleAr || prop.title) : prop.title;
      const subTitle = isAr ? prop.title : (prop.titleAr || '');
      const locationText = isAr ? (prop.locationAr || prop.location) : prop.location;

      // Dynamic action button based on property status
      let ctaButtonHtml = '';
      if (isSold) {
        ctaButtonHtml = `
          <button class="btn-card-similar status-btn-sold" data-id="${prop.id}" data-category="${prop.category}" title="${t('card_btn_similar')}">
            <span class="btn-cta-icon">❖</span> ${t('card_btn_similar')}
          </button>
        `;
      } else if (isReserved) {
        ctaButtonHtml = `
          <button class="btn-card-waitlist status-btn-reserved" data-id="${prop.id}" title="${t('card_btn_waitlist')}">
            <span class="btn-cta-icon">⏳</span> ${t('card_btn_waitlist')}
          </button>
        `;
      } else {
        ctaButtonHtml = `
          <button class="btn-card-inquire status-btn-available" data-id="${prop.id}" title="${t('card_btn_inquire')}">
            <span class="btn-cta-icon">✉</span> ${t('card_btn_inquire')}
          </button>
        `;
      }

      return `
        <article class="property-card-3d max-w-sm mx-auto w-full h-full ${isSold ? 'property-is-sold' : ''}" data-id="${prop.id}" data-status="${prop.status}" style="animation-delay: ${idx * 0.08}s">
          <div class="card-inner-box h-full">
            <!-- Media Box: Fixed vertical aspect-[4/5] with object-cover and object-center -->
            <div class="card-media-box aspect-[4/5] relative w-full overflow-hidden ${isSold ? 'is-sold' : ''}">
              <img src="${prop.mainImage}" alt="${mainTitle}" class="card-main-image object-cover object-center w-full h-full ${isSold ? 'image-sold-dimmed' : ''}" loading="lazy" />
              
              <div class="card-badge-row">
                <div class="card-badges-left">
                  ${renderStatusBadgeHtml(prop.status)}
                  <span class="card-tag ${prop.badgeColor || 'gold'}">◆ ${prop.badge}</span>
                </div>
                <span class="card-tag dark">${t('card_tag_rega', '✓ REGA Certified')}</span>
              </div>

              ${isSold ? `
                <div class="card-sold-watermark-ribbon">
                  <span>${t('card_sold_ribbon')}</span>
                </div>
              ` : ''}

              <div class="card-hover-overlay">
                <button class="btn-quick-3d" data-id="${prop.id}">
                  <span class="cube-icon">❖</span> ${t('card_btn_explore')}
                </button>
              </div>
            </div>

            <!-- Card Content -->
            <div class="card-content-box">
              <div class="card-location-meta">
                <span class="loc-pin">📍</span>
                <span class="loc-text">${locationText}</span>
              </div>
              <h3 class="card-property-title">${mainTitle}</h3>
              <p class="card-arabic-sub">${subTitle}</p>

              <!-- Specs Pills -->
              <div class="card-specs-row">
                <div class="card-spec-item">
                  <span class="spec-label">${t('card_area_label')}</span>
                  <span class="spec-val">${formatAreaWithUnit(prop.area) || prop.area}</span>
                </div>
                ${prop.bedrooms > 0 ? `
                <div class="card-spec-item">
                  <span class="spec-label">${t('card_bedrooms_label')}</span>
                  <span class="spec-val">${prop.bedrooms} ${t('card_suites_suffix')}</span>
                </div>
                ` : `
                <div class="card-spec-item">
                  <span class="spec-label">${t('card_type_label')}</span>
                  <span class="spec-val">${prop.categoryLabel}</span>
                </div>
                `}
                <div class="card-spec-item">
                  <span class="spec-label">${t('card_deed_label')}</span>
                  <span class="spec-val">${t('card_deed_val')}</span>
                </div>
              </div>

              <!-- Price & CTA Footer -->
              <div class="card-footer-action">
                <div class="card-price-group notranslate" translate="no">
                  <span class="price-prefix">${t('card_acq_price')}</span>
                  <span class="card-price-amount notranslate ${!hasPrice ? 'price-contact-text' : ''}" translate="no" ${!hasPrice ? 'dir="rtl"' : ''}>${displayPrice}</span>
                </div>
                <div class="card-cta-group">
                  ${ctaButtonHtml}
                  <button class="btn-card-explore" data-id="${prop.id}">
                    ${t('card_btn_view_dossier')}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');
  }

  bindCardInteractions() {
    const cards = this.container.querySelectorAll('.property-card-3d');
    cards.forEach(card => {
      const id = card.dataset.id;
      const found = properties.find(p => p.id === id);
      const exploreBtn = card.querySelector('.btn-card-explore');
      const quick3dBtn = card.querySelector('.btn-quick-3d');
      const inquireBtn = card.querySelector('.btn-card-inquire');
      const waitlistBtn = card.querySelector('.btn-card-waitlist');
      const similarBtn = card.querySelector('.btn-card-similar');

      const triggerOpen = (e) => {
        e.stopPropagation();
        this.modal.open(id);
      };

      if (exploreBtn) exploreBtn.addEventListener('click', triggerOpen);
      if (quick3dBtn) quick3dBtn.addEventListener('click', triggerOpen);

      // Status-specific CTA button listeners
      if (inquireBtn) {
        inquireBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          soundEngine.playClick();
          if (found) {
            this.modal.openInquiryModal(found);
          } else {
            this.modal.open(id);
          }
        });
      }

      if (waitlistBtn) {
        waitlistBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          soundEngine.playClick();
          if (found) {
            this.modal.openInquiryModal(found);
          } else {
            this.modal.open(id);
          }
        });
      }

      if (similarBtn) {
        similarBtn.addEventListener('click', (e) => {
          e.stopPropagation();
          soundEngine.playClick();
          if (found) {
            this.handleViewSimilar(found);
          }
        });
      }

      // Card surface click (ignore when clicking any action buttons)
      card.addEventListener('click', (e) => {
        if (!e.target.closest('.btn-card-inquire, .btn-card-waitlist, .btn-card-similar, .btn-card-explore, .btn-quick-3d')) {
          this.modal.open(id);
        }
      });

      // Subtle, calm 3D Tilt calculation on mouse move (toned down for comfortable, premium interaction)
      card.addEventListener('mousemove', (e) => {
        const rect = card.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;

        const rotateX = ((y - centerY) / centerY) * -1.8;
        const rotateY = ((x - centerX) / centerX) * 2;

        card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-2px)`;
      });

      card.addEventListener('mouseleave', () => {
        card.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)';
      });
    });
  }

  /**
   * Filter and highlight similar available properties
   */
  handleViewSimilar(prop) {
    soundEngine.playSwoosh();

    // Check if there are available properties in the same category (excluding current)
    const availableInCategory = properties.filter(
      p => p.status === 'available' && p.category === prop.category && p.id !== prop.id
    );

    const targetCategory = availableInCategory.length > 0 ? prop.category : 'all';

    // Update category filter pills
    const pills = document.querySelectorAll('.category-filter-pill');
    pills.forEach(p => {
      p.classList.toggle('active', p.dataset.category === targetCategory);
    });
    this.filterCategory = targetCategory;

    // Clear search and ensure max price covers available items
    this.searchQuery = '';
    const searchInput = document.querySelector('#property-search-input');
    if (searchInput) searchInput.value = '';

    // Re-filter and render
    this.applyFilters();

    // Smooth scroll to property showcase section
    const showcaseSection = document.querySelector('#properties-showcase-section');
    if (showcaseSection) {
      showcaseSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    // Highlight available property cards with luxury pulse
    setTimeout(() => {
      const availableCards = this.container.querySelectorAll('.property-card-3d[data-status="available"]');
      availableCards.forEach(card => {
        card.classList.add('pulse-similar-highlight');
        setTimeout(() => card.classList.remove('pulse-similar-highlight'), 2600);
      });
    }, 450);

    // Toast feedback notification
    statusToast.show({
      title: 'SIMILAR VERIFIED ASSETS',
      message: `Displaying available properties matching "${prop.title}".`,
      subtext: availableInCategory.length > 0 
        ? `${availableInCategory.length} active asset(s) found in ${prop.categoryLabel}.`
        : `Showing all active verified portfolio assets.`,
      status: 'available',
      duration: 4500
    });
  }
}
