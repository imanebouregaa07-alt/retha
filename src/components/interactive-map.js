import L from 'leaflet';
import 'leaflet.markercluster/dist/MarkerCluster.css';
import 'leaflet.markercluster/dist/MarkerCluster.Default.css';

// Ensure Leaflet is globally available for plugins
if (typeof window !== 'undefined') {
  window.L = L;
}
if (typeof globalThis !== 'undefined') {
  globalThis.L = L;
}

import { properties, renderStatusBadgeHtml, formatAreaWithUnit } from '../data/properties.js';
import { soundEngine } from './audio-controller.js';
import { t, getLanguage } from '../i18n/i18n.js';

// Canonical luxury Riyadh district metadata and coordinates
const KNOWN_DISTRICTS_METADATA = {
  'al-malqa': { name: 'Al-Malqa', nameAr: 'الملقا', lat: 24.8150, lng: 46.6025, zoom: 14 },
  'hittin': { name: 'Hittin', nameAr: 'حطين', lat: 24.7720, lng: 46.5980, zoom: 14 },
  'al-hada': { name: 'Al-Hada / DQ', nameAr: 'الهدا / الحي الدبلوماسي', lat: 24.6850, lng: 46.6200, zoom: 14 },
  'kafd': { name: 'KAFD Financial District', nameAr: 'المركز المالي', lat: 24.7680, lng: 46.6430, zoom: 15 },
  'king salman': { name: 'King Salman Corridor', nameAr: 'طريق الملك سلمان', lat: 24.8720, lng: 46.6180, zoom: 13 },
  'king salman road': { name: 'King Salman Corridor', nameAr: 'طريق الملك سلمان', lat: 24.8720, lng: 46.6180, zoom: 13 },
  'al-nakheel': { name: 'Al-Nakheel', nameAr: 'النخيل', lat: 24.7480, lng: 46.6280, zoom: 14 },
  'al-yasmin': { name: 'Al-Yasmin', nameAr: 'الياسمين', lat: 24.8320, lng: 46.6480, zoom: 14 },
  'al-sahafa': { name: 'Al-Sahafa', nameAr: 'الصحافة', lat: 24.7950, lng: 46.6420, zoom: 14 },
  'al-rabi': { name: 'Al-Rabi', nameAr: 'الربيع', lat: 24.7980, lng: 46.6780, zoom: 14 },
  'al-muhammadiyah': { name: 'Al-Muhammadiyah', nameAr: 'المحمدية', lat: 24.7320, lng: 46.6580, zoom: 14 },
  'diplomatic quarter': { name: 'Diplomatic Quarter', nameAr: 'حي السفارات', lat: 24.6780, lng: 46.6250, zoom: 14 }
};

export class InteractiveMap {
  constructor(propertyModal) {
    this.modal = propertyModal;
    this.mapContainer = document.querySelector('#luxury-interactive-map');
    this.map = null;
    this.markerClusterGroup = null;
    this.markers = [];
    this.circles = [];
    this.activeCategory = 'all';
    this.activeDistrict = 'all';
    this.districts = [];
    this.isDropdownOpen = false;

    this.injectClusterStyles();
    this.init();
  }

  injectClusterStyles() {
    if (document.getElementById('luxury-cluster-styles')) return;
    const styleEl = document.createElement('style');
    styleEl.id = 'luxury-cluster-styles';
    styleEl.textContent = `
      /* Custom Luxury Leaflet Cluster Icon */
      .luxury-cluster-icon-wrapper {
        background: transparent !important;
        border: none !important;
      }
      .luxury-map-cluster-bubble {
        position: relative;
        width: 100%;
        height: 100%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        user-select: none;
      }
      .luxury-map-cluster-bubble .cluster-pulse-ring {
        position: absolute;
        inset: -4px;
        border-radius: 50%;
        border: 1.5px solid rgba(212, 175, 55, 0.65);
        background: radial-gradient(circle, rgba(212, 175, 55, 0.3) 0%, rgba(212, 175, 55, 0.08) 65%, transparent 100%);
        animation: luxuryClusterPulse 2.6s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        pointer-events: none;
      }
      @keyframes luxuryClusterPulse {
        0% {
          transform: scale(0.9);
          opacity: 0.85;
          box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.6);
        }
        50% {
          transform: scale(1.15);
          opacity: 0.3;
          box-shadow: 0 0 18px 2px rgba(212, 175, 55, 0.35);
        }
        100% {
          transform: scale(0.9);
          opacity: 0.85;
          box-shadow: 0 0 0 0 rgba(212, 175, 55, 0);
        }
      }
      .luxury-map-cluster-bubble .cluster-core {
        position: relative;
        width: 100%;
        height: 100%;
        border-radius: 50%;
        background: linear-gradient(135deg, #1A1D26 0%, #0B0D13 60%, #151821 100%);
        border: 1.5px solid rgba(212, 175, 55, 0.85);
        box-shadow: 
          0 4px 18px rgba(0, 0, 0, 0.75),
          inset 0 1px 1.5px rgba(255, 255, 255, 0.2),
          0 0 14px rgba(212, 175, 55, 0.35);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1), box-shadow 0.25s ease, border-color 0.25s ease;
        backdrop-filter: blur(8px);
        -webkit-backdrop-filter: blur(8px);
      }
      .luxury-map-cluster-bubble:hover .cluster-core {
        transform: scale(1.1);
        border-color: #ECC880;
        box-shadow: 
          0 6px 24px rgba(0, 0, 0, 0.9),
          inset 0 1px 2px rgba(255, 255, 255, 0.3),
          0 0 22px rgba(212, 175, 55, 0.7);
      }
      .luxury-map-cluster-bubble .cluster-glyph {
        font-size: 8px;
        line-height: 1;
        color: #ECC880;
        margin-bottom: 2px;
        filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.8));
      }
      .luxury-map-cluster-bubble .cluster-count {
        font-family: 'Cinzel', 'Plus Jakarta Sans', serif, sans-serif;
        font-size: 13px;
        font-weight: 700;
        letter-spacing: 0.5px;
        background: linear-gradient(135deg, #FFFFFF 0%, #ECC880 50%, #D4AF37 100%);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        line-height: 1;
      }
      /* Leaflet Spider Leg Luxury Styling */
      .leaflet-cluster-spider-leg {
        stroke: #D4AF37 !important;
        stroke-width: 1.5px !important;
        stroke-dasharray: 4, 4 !important;
        stroke-opacity: 0.8 !important;
        filter: drop-shadow(0 0 4px rgba(212, 175, 55, 0.5));
      }
    `;
    document.head.appendChild(styleEl);
  }

  async init() {
    if (!this.mapContainer) return;

    if (typeof window !== 'undefined' && !window.L) {
      window.L = L;
    }
    if (!L.markerClusterGroup) {
      await import('leaflet.markercluster');
    }

    // Riyadh central coordinate
    const center = [24.7740, 46.6320];

    this.map = L.map('luxury-interactive-map', {
      center: center,
      zoom: 12,
      minZoom: 10,
      maxZoom: 17,
      zoomControl: false,
      attributionControl: false
    });

    // Standard Free OpenStreetMap Tile Layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors'
    }).addTo(this.map);

    // Custom Zoom controls
    L.control.zoom({ position: 'bottomright' }).addTo(this.map);

    // Initialize Luxury Marker Cluster Group
    this.markerClusterGroup = L.markerClusterGroup({
      maxClusterRadius: 45,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      spiderfyOnMaxZoom: true,
      spiderfyDistanceMultiplier: 1.6,
      spiderLegPolylineOptions: {
        weight: 1.5,
        color: '#D4AF37',
        opacity: 0.8,
        dashArray: '4, 4'
      },
      iconCreateFunction: (cluster) => {
        const count = cluster.getChildCount();
        const size = count < 10 ? 46 : count < 50 ? 52 : 58;
        return L.divIcon({
          className: 'luxury-cluster-icon-wrapper notranslate',
          html: `
            <div class="luxury-map-cluster-bubble" translate="no" title="${count} properties">
              <div class="cluster-pulse-ring"></div>
              <div class="cluster-core">
                <span class="cluster-glyph">✦</span>
                <span class="cluster-count">${count}</span>
              </div>
            </div>
          `,
          iconSize: [size, size],
          iconAnchor: [Math.round(size / 2), Math.round(size / 2)]
        });
      }
    });

    // Handle cluster click: sound feedback and instant spiderfy if pins share identical coordinates
    this.markerClusterGroup.on('clusterclick', (c) => {
      soundEngine.playClick();
      const cluster = c.layer;
      const childMarkers = cluster.getAllChildMarkers();
      if (childMarkers.length > 1) {
        const firstLatLng = childMarkers[0].getLatLng();
        const allSameLocation = childMarkers.every(m => {
          const latLng = m.getLatLng();
          return Math.abs(latLng.lat - firstLatLng.lat) < 0.0001 && Math.abs(latLng.lng - firstLatLng.lng) < 0.0001;
        });
        if (allSameLocation) {
          cluster.spiderfy();
        }
      }
    });

    this.map.addLayer(this.markerClusterGroup);

    this.renderMarkers();
    this.bindMapFilters();
    this.buildDistrictsList();
    this.bindDistrictDropdown();

    // Re-render markers and rebuild district options if dynamic properties arrive or update
    window.addEventListener('retha:properties-changed', () => {
      this.buildDistrictsList();
      this.renderMarkers();
    });

    // Re-render when global language changes
    window.addEventListener('retha:lang-changed', () => {
      this.buildDistrictsList();
      this.renderMarkers();
    });
  }

  /**
   * Dynamically build district list only from active properties in the database
   */
  buildDistrictsList() {
    const districtMap = new Map();

    properties.forEach(prop => {
      const rawDist = (prop.district || prop.location || 'Riyadh').trim();
      if (!rawDist) return;

      let key = rawDist.toLowerCase();
      if (key.includes('malqa') || key.includes('ملقا')) key = 'al-malqa';
      else if (key.includes('hittin') || key.includes('حطين')) key = 'hittin';
      else if (key.includes('hada') || key.includes('هدا') || key.includes('dq') || key.includes('diplomatic')) key = 'al-hada';
      else if (key.includes('kafd') || key.includes('مالي') || key.includes('financial')) key = 'kafd';
      else if (key.includes('salman') || key.includes('سلمان')) key = 'king salman';
      else if (key.includes('nakheel') || key.includes('نخيل')) key = 'al-nakheel';
      else if (key.includes('yasmin') || key.includes('ياسمين')) key = 'al-yasmin';
      else if (key.includes('sahafa') || key.includes('صحافة')) key = 'al-sahafa';

      if (!districtMap.has(key)) {
        districtMap.set(key, {
          key: key,
          rawName: rawDist,
          properties: []
        });
      }
      districtMap.get(key).properties.push(prop);
    });

    this.districts = [];
    districtMap.forEach((data, key) => {
      const props = data.properties;
      const meta = KNOWN_DISTRICTS_METADATA[key];

      let name = meta ? meta.name : data.rawName;
      let nameAr = meta ? meta.nameAr : '';
      if (!nameAr && props[0]?.locationAr) {
        nameAr = props[0].locationAr.split('،')[0].replace('حي ', '').trim();
      }

      let lat = meta ? meta.lat : 0;
      let lng = meta ? meta.lng : 0;
      let zoom = meta ? meta.zoom : 14;

      if (!lat || !lng) {
        const validCoords = props.filter(p => Array.isArray(p.coordinates) && p.coordinates.length === 2 && !isNaN(p.coordinates[0]));
        if (validCoords.length > 0) {
          lat = validCoords.reduce((acc, p) => acc + p.coordinates[0], 0) / validCoords.length;
          lng = validCoords.reduce((acc, p) => acc + p.coordinates[1], 0) / validCoords.length;
        } else {
          lat = 24.7740;
          lng = 46.6320;
        }
      }

      this.districts.push({
        id: key,
        name: name,
        nameAr: nameAr || name,
        label: nameAr ? `${name} (${nameAr})` : name,
        lat: lat,
        lng: lng,
        zoom: zoom,
        count: props.length,
        properties: props
      });
    });

    // Sort alphabetically by English name
    this.districts.sort((a, b) => a.name.localeCompare(b.name));

    // Update count badge in UI
    const badge = document.querySelector('#map-district-count-badge');
    if (badge) {
      const isAr = getLanguage() === 'ar';
      badge.textContent = isAr
        ? `${this.districts.length} أحياء نشطة`
        : `${this.districts.length} Active ${this.districts.length === 1 ? 'District' : 'Districts'}`;
    }

    this.renderDistrictOptions();
  }

  /**
   * Render options inside the custom dropdown with live search query filtering
   */
  renderDistrictOptions(filterQuery = '') {
    const container = document.querySelector('#map-district-options');
    if (!container) return;

    const isAr = getLanguage() === 'ar';
    const q = filterQuery.toLowerCase().trim();
    const filtered = q
      ? this.districts.filter(d => 
          d.name.toLowerCase().includes(q) || 
          d.nameAr.toLowerCase().includes(q) || 
          d.label.toLowerCase().includes(q)
        )
      : this.districts;

    const totalProps = properties.length;
    let html = '';

    // "All Riyadh Districts" option (visible when not filtering by specific search)
    if (!q) {
      const isAllActive = this.activeDistrict === 'all';
      const allText = isAr ? 'كافة أحياء الرياض (جميع الأحياء)' : 'All Riyadh Districts (جميع الأحياء)';
      const badgeText = isAr ? `${totalProps} عقارات معتمدة` : `${totalProps} ${totalProps === 1 ? 'Estate' : 'Estates'}`;
      html += `
        <div class="district-option-item ${isAllActive ? 'is-selected' : ''}" data-district="all" role="option" aria-selected="${isAllActive}">
          <div class="district-option-main">
            <span class="district-option-icon">🏛️</span>
            <span class="district-option-name">${allText}</span>
          </div>
          <span class="district-option-badge">${badgeText}</span>
        </div>
        <div style="height: 1px; background: var(--border-subtle); margin: 4px 0;"></div>
      `;
    }

    if (filtered.length === 0) {
      const emptyText = isAr ? `لا توجد أحياء تطابق "${filterQuery}"` : `No neighborhoods matching "${filterQuery}"`;
      html += `
        <div class="district-empty-msg">
          <span>🔍 ${emptyText}</span>
        </div>
      `;
    } else {
      filtered.forEach(dist => {
        const isSelected = this.activeDistrict === dist.id;
        const countLabel = isAr ? `${dist.count} عقار` : (dist.count === 1 ? '1 Estate' : `${dist.count} Estates`);
        const displayName = isAr && dist.nameAr ? `${dist.nameAr} (${dist.name})` : dist.label;
        html += `
          <div class="district-option-item ${isSelected ? 'is-selected' : ''}" data-district="${dist.id}" role="option" aria-selected="${isSelected}">
            <div class="district-option-main">
              <span class="district-option-icon">📍</span>
              <span class="district-option-name">${displayName}</span>
            </div>
            <span class="district-option-badge">${countLabel}</span>
          </div>
        `;
      });
    }

    container.innerHTML = html;

    // Attach click listeners to all options
    container.querySelectorAll('.district-option-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.stopPropagation();
        soundEngine.playClick();
        const distId = item.dataset.district;
        this.selectDistrict(distId);
      });
    });
  }

  /**
   * Handle neighborhood selection: updates UI, filters pins, and flies map
   */
  selectDistrict(distId) {
    this.activeDistrict = distId;
    const labelEl = document.querySelector('#map-selected-district-label');
    const clearBtn = document.querySelector('#map-district-clear');
    const isAr = getLanguage() === 'ar';

    if (distId === 'all') {
      if (labelEl) labelEl.textContent = isAr ? 'كافة أحياء الرياض (جميع الأحياء)' : 'All Riyadh Districts (جميع الأحياء)';
      if (clearBtn) clearBtn.style.display = 'none';

      this.closeDropdown();
      this.renderMarkers();
      this.renderDistrictOptions();

      // Fly to Riyadh center overview
      this.map.flyTo([24.7740, 46.6320], 12, {
        duration: 1.5,
        easeLinearity: 0.25
      });
      return;
    }

    const dist = this.districts.find(d => d.id === distId);
    if (!dist) return;

    if (labelEl) {
      const countLabel = isAr ? `${dist.count} عقار` : (dist.count === 1 ? '1 Estate' : `${dist.count} Estates`);
      const distName = isAr && dist.nameAr ? dist.nameAr : dist.name;
      labelEl.textContent = `${distName} • ${countLabel}`;
    }
    if (clearBtn) clearBtn.style.display = 'inline-block';

    this.closeDropdown();
    this.renderMarkers();
    this.renderDistrictOptions();

    // Fly to neighborhood coordinates with designated focus zoom
    this.map.flyTo([dist.lat, dist.lng], dist.zoom || 14, {
      duration: 1.5,
      easeLinearity: 0.25
    });

    // Automatically highlight/open the first property in this neighborhood after flight
    if (this.markers.length > 0) {
      setTimeout(() => {
        if (this.activeDistrict === distId && this.markers[0]) {
          if (this.markerClusterGroup && this.markerClusterGroup.hasLayer(this.markers[0])) {
            this.markerClusterGroup.zoomToShowLayer(this.markers[0], () => {
              this.markers[0].openPopup();
            });
          } else {
            this.markers[0].openPopup();
          }
        }
      }, 1600);
    }
  }

  /**
   * Bind dropdown interactions: open/close, live search, reset button, and click outside
   */
  bindDistrictDropdown() {
    const dropdown = document.querySelector('#map-district-dropdown');
    const trigger = document.querySelector('#map-district-trigger');
    const searchInput = document.querySelector('#map-district-search');
    const searchClear = document.querySelector('#map-search-clear');
    const resetBtn = document.querySelector('#map-district-clear');

    if (!dropdown || !trigger) return;

    // Toggle dropdown
    trigger.addEventListener('click', (e) => {
      if (e.target.closest('#map-district-clear')) return;
      this.toggleDropdown();
    });

    // Keyboard support for trigger (Enter or Space)
    trigger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        this.toggleDropdown();
      } else if (e.key === 'Escape') {
        this.closeDropdown();
      }
    });

    // Reset button inside trigger
    if (resetBtn) {
      resetBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        soundEngine.playClick();
        this.selectDistrict('all');
      });
    }

    // Live search input filtering
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const val = e.target.value;
        if (searchClear) {
          searchClear.style.display = val ? 'inline-block' : 'none';
        }
        this.renderDistrictOptions(val);
      });

      searchInput.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          this.closeDropdown();
        }
      });
    }

    // Clear search text button
    if (searchClear) {
      searchClear.addEventListener('click', (e) => {
        e.stopPropagation();
        if (searchInput) {
          searchInput.value = '';
          searchInput.focus();
        }
        searchClear.style.display = 'none';
        this.renderDistrictOptions('');
      });
    }

    // Click outside to close
    document.addEventListener('click', (e) => {
      if (!dropdown.contains(e.target)) {
        this.closeDropdown();
      }
    });
  }

  toggleDropdown() {
    if (this.isDropdownOpen) {
      this.closeDropdown();
    } else {
      this.openDropdown();
    }
  }

  openDropdown() {
    const dropdown = document.querySelector('#map-district-dropdown');
    const trigger = document.querySelector('#map-district-trigger');
    const searchInput = document.querySelector('#map-district-search');
    if (!dropdown) return;

    soundEngine.playClick();
    this.isDropdownOpen = true;
    dropdown.classList.add('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'true');

    if (searchInput) {
      setTimeout(() => searchInput.focus(), 80);
    }
  }

  closeDropdown() {
    const dropdown = document.querySelector('#map-district-dropdown');
    const trigger = document.querySelector('#map-district-trigger');
    const searchInput = document.querySelector('#map-district-search');
    const searchClear = document.querySelector('#map-search-clear');
    if (!dropdown) return;

    this.isDropdownOpen = false;
    dropdown.classList.remove('is-open');
    if (trigger) trigger.setAttribute('aria-expanded', 'false');

    if (searchInput) searchInput.value = '';
    if (searchClear) searchClear.style.display = 'none';
    this.renderDistrictOptions('');
  }

  createGoldIcon(prop) {
    const isLand = prop.category === 'land';
    const isOffice = prop.category === 'office';
    const iconSymbol = isLand ? '📐' : isOffice ? '🏢' : '✦';

    const rawPrice = prop.priceSAR ?? prop.price;
    const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
    const hasPrice = priceNum > 0;

    let priceLabel = 'تواصل معنا';
    if (hasPrice) {
      priceLabel = priceNum >= 10000000
        ? (priceNum / 1000000).toFixed(0) + 'M'
        : (priceNum / 1000000).toFixed(1) + 'M';
    }

    const isContact = !hasPrice;
    const pinWidth = isContact ? 118 : 84;
    const pinHeight = 44;
    const anchorX = Math.round(pinWidth / 2);
    const anchorY = pinHeight;

    return L.divIcon({
      className: `custom-luxury-pin-wrapper notranslate ${isContact ? 'is-contact-pin' : ''}`,
      html: `
        <div class="luxury-map-pin notranslate ${isContact ? 'pin-contact' : ''}" data-id="${prop.id}" translate="no">
          <div class="pin-pulse"></div>
          <div class="pin-badge notranslate ${isContact ? 'badge-contact' : ''}" translate="no">
            <span class="pin-icon notranslate" translate="no">${iconSymbol}</span>
            <span class="pin-price notranslate ${isContact ? 'price-contact-text' : ''}" translate="no" ${isContact ? 'dir="rtl"' : ''}>${priceLabel}</span>
          </div>
          <div class="pin-tail"></div>
        </div>
      `,
      iconSize: [pinWidth, pinHeight],
      iconAnchor: [anchorX, anchorY],
      popupAnchor: [0, -48]
    });
  }

  renderMarkers() {
    // Clear existing markers, clusters, and neighborhood circles
    if (this.markerClusterGroup) {
      this.markerClusterGroup.clearLayers();
    }
    this.circles.forEach(c => this.map.removeLayer(c));
    this.markers = [];
    this.circles = [];

    const renderedCircleCoords = new Set();

    properties.forEach(prop => {
      // 1. Category Filter check
      if (this.activeCategory !== 'all' && prop.category !== this.activeCategory) {
        return;
      }

      // 2. District Filter check
      if (this.activeDistrict !== 'all') {
        const rawDist = (prop.district || prop.location || '').toLowerCase();
        let propKey = rawDist;
        if (rawDist.includes('malqa') || rawDist.includes('ملقا')) propKey = 'al-malqa';
        else if (rawDist.includes('hittin') || rawDist.includes('حطين')) propKey = 'hittin';
        else if (rawDist.includes('hada') || rawDist.includes('هدا') || rawDist.includes('dq') || rawDist.includes('diplomatic')) propKey = 'al-hada';
        else if (rawDist.includes('kafd') || rawDist.includes('مالي') || rawDist.includes('financial')) propKey = 'kafd';
        else if (rawDist.includes('salman') || rawDist.includes('سلمان')) propKey = 'king salman';
        else if (rawDist.includes('nakheel') || rawDist.includes('نخيل')) propKey = 'al-nakheel';
        else if (rawDist.includes('yasmin') || rawDist.includes('ياسمين')) propKey = 'al-yasmin';
        else if (rawDist.includes('sahafa') || rawDist.includes('صحافة')) propKey = 'al-sahafa';

        if (propKey !== this.activeDistrict && !rawDist.includes(this.activeDistrict)) {
          return;
        }
      }

      // Approximate neighborhood circle (1000 meters radius, deduplicated per location)
      if (Array.isArray(prop.coordinates) && prop.coordinates.length === 2 && !isNaN(prop.coordinates[0])) {
        const coordKey = `${Number(prop.coordinates[0]).toFixed(3)},${Number(prop.coordinates[1]).toFixed(3)}`;
        if (!renderedCircleCoords.has(coordKey)) {
          renderedCircleCoords.add(coordKey);
          const circle = L.circle(prop.coordinates, {
            radius: 1000,
            color: '#D4AF37',
            weight: 1.5,
            opacity: 0.65,
            fillColor: '#D4AF37',
            fillOpacity: 0.12,
            dashArray: '5, 8',
            interactive: false
          }).addTo(this.map);
          this.circles.push(circle);
        }
      }

      const icon = this.createGoldIcon(prop);
      const marker = L.marker(prop.coordinates, { icon: icon });

      const isAr = getLanguage() === 'ar';
      const rawPrice = prop.priceSAR ?? prop.price;
      const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
      const hasPrice = priceNum > 0;
      const popupPrice = hasPrice ? (prop.priceFormattedSAR && prop.priceFormattedSAR !== 'تواصل معنا' ? prop.priceFormattedSAR : `${priceNum.toLocaleString('en-US')} SAR`) : t('price_contact_us', 'تواصل معنا');
      const popupTitle = isAr ? (prop.titleAr || prop.title) : prop.title;
      const popupLocation = isAr ? (prop.locationAr || prop.location) : prop.location;
      const bedText = isAr ? `${prop.bedrooms} غرف نوم` : `${prop.bedrooms} Bed`;
      const regaTag = isAr ? 'معتمد من الهيئة' : 'REGA Certified';

      const popupHtml = `
        <div class="luxury-map-popup-card">
          <div class="popup-image-holder">
            <img src="${prop.mainImage}" alt="${popupTitle}" class="${prop.status === 'sold' ? 'image-sold-dimmed' : ''}" />
            <div class="popup-badges-wrap">
              ${renderStatusBadgeHtml(prop.status, 'popup-status-badge')}
              <span class="popup-badge">${prop.badge}</span>
            </div>
          </div>
          <div class="popup-info">
            <span class="popup-location">📍 ${popupLocation}</span>
            <h4 class="popup-title">${popupTitle}</h4>
            <div class="popup-specs">
              <span>${formatAreaWithUnit(prop.area) || prop.area}</span>
              ${prop.bedrooms > 0 ? `<span>• ${bedText}</span>` : ''}
              <span>• ${regaTag}</span>
            </div>
            <div class="popup-approx-notice notranslate" translate="no" dir="rtl">
              <span class="approx-pin-icon">📍</span> الموقع تقريبي ويشير إلى الحي العام
            </div>
            <div class="popup-bottom-row">
              <span class="popup-price notranslate ${!hasPrice ? 'price-contact-text' : ''}" translate="no" ${!hasPrice ? 'dir="rtl"' : ''}>${popupPrice}</span>
              <button class="popup-btn-explore" data-id="${prop.id}">${t('card_btn_view_dossier', 'View Dossier')}</button>
            </div>
          </div>
        </div>
      `;

      marker.bindPopup(popupHtml, {
        className: 'luxury-custom-leaflet-popup',
        maxWidth: 320,
        closeButton: true
      });

      marker.on('popupopen', () => {
        soundEngine.playClick();
        const btn = document.querySelector(`.popup-btn-explore[data-id="${prop.id}"]`);
        if (btn) {
          btn.addEventListener('click', () => {
            this.modal.open(prop.id);
          });
        }
      });

      if (this.markerClusterGroup) {
        this.markerClusterGroup.addLayer(marker);
      } else {
        marker.addTo(this.map);
      }

      this.markers.push(marker);
    });
  }

  bindMapFilters() {
    const filterBtns = document.querySelectorAll('.map-filter-pill');
    filterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        soundEngine.playClick();
        filterBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        this.activeCategory = btn.dataset.category;
        this.renderMarkers();
      });
    });
  }
}

