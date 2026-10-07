/**
 * RETHA Real Estate — Property Data Service
 * Dynamically fetches properties and slider images from Supabase.
 * Hardcoded mock data completely removed.
 */
import { supabase } from '../utils/supabase.js';

// Exported mutable array populated dynamically from Supabase
export let properties = [];

/**
 * Ensure area values always carry the standard metric unit (e.g. 350 m² or 350 sqm)
 */
export function formatAreaWithUnit(val) {
  if (!val && val !== 0) return '';
  const str = String(val).trim();
  if (!str) return '';
  if (str.includes('m²') || str.toLowerCase().includes('sqm')) {
    return str;
  }
  return `${str} m²`;
}

/**
 * Formats property price with fallback to Arabic 'تواصل معنا' if price is null, undefined, or 0.
 * Guarantees that "0" or "0 ريال" or "0 SAR" is NEVER displayed.
 */
export function formatPropertyPrice(prop, currency = 'SAR') {
  if (!prop) return 'تواصل معنا';
  const rawPrice = prop.priceSAR ?? prop.price;
  const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
  if (!priceNum || priceNum <= 0) {
    return 'تواصل معنا';
  }
  if (currency === 'USD') {
    return (prop.priceFormattedUSD && !prop.priceFormattedUSD.includes('0') && prop.priceFormattedUSD !== 'تواصل معنا')
      ? prop.priceFormattedUSD
      : `$${Math.round(priceNum / 3.75).toLocaleString('en-US')} USD`;
  }
  return (prop.priceFormattedSAR && !prop.priceFormattedSAR.includes('0') && prop.priceFormattedSAR !== 'تواصل معنا')
    ? prop.priceFormattedSAR
    : `${priceNum.toLocaleString('en-US')} SAR`;
}

/**
 * Rounds a number to the nearest standard luxury real estate benchmark multiplier.
 */
function roundToNiceBenchmark(val) {
  if (val <= 0) return 0;
  const mag = Math.pow(10, Math.floor(Math.log10(val)));
  const norm = val / mag;
  const niceMultipliers = [1, 1.2, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 6, 7, 8, 9, 10];
  let closest = niceMultipliers[0];
  let minDiff = Math.abs(norm - closest);
  for (const m of niceMultipliers) {
    const diff = Math.abs(norm - m);
    if (diff < minDiff) {
      minDiff = diff;
      closest = m;
    }
  }
  return Math.round(closest * mag);
}

/**
 * Dynamically generates 4 to 5 sensible budget ranges tailored to any given property price.
 * For example:
 * Price 8,800,000 SAR yields:
 * - Under 8,000,000 SAR
 * - 8,000,000 - 10,000,000 SAR (selected by default)
 * - 10,000,000 - 15,000,000 SAR
 * - Above 15,000,000 SAR
 */
export function generateDynamicBudgetRanges(price) {
  const p = Number(price);
  if (!p || isNaN(p) || p <= 0) return [];

  // b1: benchmark comfortably below price (~85-90% of price, e.g. 8M for 8.8M)
  let b1 = roundToNiceBenchmark(p * 0.9);
  if (b1 >= p) {
    b1 = roundToNiceBenchmark(p * 0.8);
  }
  if (b1 <= 0 || b1 >= p) {
    b1 = Math.round(p * 0.75);
  }

  // b2: benchmark comfortably above price (~115-120% of price, e.g. 10M for 8.8M)
  let b2 = roundToNiceBenchmark(p * 1.15);
  if (b2 <= p || b2 <= b1) {
    b2 = roundToNiceBenchmark(Math.max(p * 1.2, b1 * 1.25));
  }
  if (b2 <= p || b2 <= b1) {
    b2 = Math.round(Math.max(p * 1.25, b1 + 500000));
  }

  // b3: upper bracket benchmark (~1.5x of b2, e.g. 15M for 10M)
  let b3 = roundToNiceBenchmark(b2 * 1.5);
  if (b3 <= b2) {
    b3 = roundToNiceBenchmark(b2 * 1.75);
  }

  const fmt = (n) => n.toLocaleString('en-US');

  return [
    { label: `Under ${fmt(b1)} SAR`, value: `Under ${fmt(b1)} SAR`, selected: false },
    { label: `${fmt(b1)} - ${fmt(b2)} SAR`, value: `${fmt(b1)} - ${fmt(b2)} SAR`, selected: true },
    { label: `${fmt(b2)} - ${fmt(b3)} SAR`, value: `${fmt(b2)} - ${fmt(b3)} SAR`, selected: false },
    { label: `Above ${fmt(b3)} SAR`, value: `Above ${fmt(b3)} SAR`, selected: false }
  ];
}

/**
 * Transform Supabase database row (with nested property_images)
 * into the complete frontend property model.
 */
export function mapDatabaseProperty(row) {
  const metadata = row.metadata || {};

  // Map ALL database images without any hardcoded limit or truncation
  const rawImages = Array.isArray(row.property_images) ? row.property_images : [];
  const sortedImages = rawImages.slice().sort((a, b) => (a.display_order || 0) - (b.display_order || 0));

  // Determine main image fallback
  const mainImage = row.main_image || (sortedImages[0] ? sortedImages[0].image_url : '/images/villa_facade_front.webp');

  // Map ALL images fetched from Supabase database
  const allImages = sortedImages.map((img, idx) => ({
    id: img.id || `img-${idx}`,
    url: img.image_url,
    title: img.title || (img.image_type === 'interior' ? 'Interior View' : (img.image_type === 'exterior' ? 'Exterior View' : 'Property View')),
    desc: img.description || '',
    type: img.image_type || 'exterior',
    order: img.display_order ?? idx
  }));

  // Fallback if no images are attached in property_images
  if (allImages.length === 0 && mainImage) {
    allImages.push({
      id: 'main-img-fallback',
      url: mainImage,
      title: row.title || 'Property View',
      desc: metadata.location || row.neighborhood || '',
      type: 'exterior',
      order: 0
    });
  }

  // Categorized views for tabs
  const exterior = allImages.filter(img => img.type === 'exterior');
  const interior = allImages.filter(img => img.type === 'interior');

  // Find 360 panorama image if present
  const panoramaImg = sortedImages.find(img => img.image_type === 'panorama360');
  const panorama360 = panoramaImg ? panoramaImg.image_url : (metadata.panorama360 || null);

  // Price calculation & fallback check:
  // If price is null, undefined, or exactly 0, NEVER display 0 or 0 ريال; display "تواصل معنا"
  const rawPrice = row.price;
  const priceNum = (rawPrice !== null && rawPrice !== undefined && Number(rawPrice) > 0) ? Number(rawPrice) : 0;
  const hasPrice = priceNum > 0;

  const formattedSAR = hasPrice
    ? (metadata.priceFormattedSAR && !metadata.priceFormattedSAR.startsWith('0') && !metadata.priceFormattedSAR.includes('0 ريال')
        ? metadata.priceFormattedSAR
        : `${priceNum.toLocaleString('en-US')} SAR`)
    : 'تواصل معنا';

  const formattedUSD = hasPrice
    ? (metadata.priceFormattedUSD && !metadata.priceFormattedUSD.startsWith('$0')
        ? metadata.priceFormattedUSD
        : `$${Math.round(priceNum / 3.75).toLocaleString('en-US')} USD`)
    : 'تواصل معنا';

  // Fallback category labels
  const defaultCategoryLabels = {
    villa: 'Exclusive Villa',
    apartment: 'Luxury Penthouse',
    office: 'Commercial & Office',
    land: 'Investment Land'
  };

  return {
    id: row.slug || row.id,
    dbId: row.id,
    slug: row.slug || row.id,
    title: row.title,
    titleAr: row.title_ar || row.title,
    category: row.property_type || 'villa',
    categoryLabel: metadata.categoryLabel || defaultCategoryLabels[row.property_type] || 'Exclusive Property',
    hasPrice: hasPrice,
    priceSAR: priceNum,
    priceFormattedSAR: formattedSAR,
    priceFormattedUSD: formattedUSD,
    location: metadata.location || (row.neighborhood ? `${row.neighborhood}, Northern ${row.city || 'Riyadh'}` : (row.city || 'Riyadh')),
    locationAr: metadata.locationAr || (row.neighborhood ? `حي ${row.neighborhood}، ${row.city || 'الرياض'}` : 'الرياض'),
    district: row.neighborhood || 'Riyadh',
    area: formatAreaWithUnit(metadata.areaFormatted || (row.area_sqm ? `${Number(row.area_sqm).toLocaleString('en-US')}` : (row.area || ''))),
    builtUpArea: formatAreaWithUnit(row.built_up_area || metadata.builtUpAreaFormatted || (row.area_sqm ? `${Number(row.area_sqm).toLocaleString('en-US')}` : '')),
    bedrooms: row.bedrooms ?? 0,
    bathrooms: row.bathrooms ?? 0,
    garageCapacity: row.garage_capacity || '',
    streetWidth: row.street_width || '',
    orientation: row.orientation || '',
    deedNumber: row.deed_number || '',
    regaLicense: (row.reference_code ? row.reference_code.replace('1200028491', '1200033904').replace('REGA-VAL', 'FAL') : 'FAL #1200033904'),
    status: row.status || 'available',
    badge: row.badge || 'Official Exclusive',
    badgeColor: row.badge_color || 'gold',
    mainImage: mainImage,
    images: allImages,
    gallery: {
      all: allImages,
      exterior: exterior.length > 0 ? exterior : allImages,
      interior: interior,
      panorama360: panorama360,
      floorPlan: metadata.floorPlan || null
    },
    amenities: Array.isArray(row.amenities) ? row.amenities : [],
    coordinates: (row.latitude && row.longitude) ? [Number(row.latitude), Number(row.longitude)] : [24.7740, 46.6320],
    description: row.description || '',
    featuresSummary: row.features_summary || ''
  };
}

/**
 * Fetch properties and their linked slider images dynamically from Supabase
 */
export async function loadProperties() {
  try {
    const { data, error } = await supabase
      .from('properties')
      .select('*, property_images(*)')
      .order('price', { ascending: false });

    if (error) {
      console.error('[RETHA Supabase] Error fetching properties:', error);
      return properties;
    }

    if (data && data.length > 0) {
      const transformed = data.map(mapDatabaseProperty);
      // Mutate properties array in-place to maintain reference across all importing modules
      properties.length = 0;
      properties.push(...transformed);

      // Dispatch global event for reactive UI updates
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('retha:properties-loaded', {
          detail: { properties: [...properties] }
        }));
        window.dispatchEvent(new CustomEvent('retha:properties-changed', {
          detail: { properties: [...properties] }
        }));
      }
    }

    return properties;
  } catch (err) {
    console.error('[RETHA Supabase] Unexpected error fetching properties:', err);
    return properties;
  }
}

// Initial fetch promise for async awaiting across the application
export const propertiesPromise = loadProperties();

/**
 * Property Status Badging Configuration
 */
export const STATUS_CONFIG = {
  available: {
    key: "available",
    label: "Available",
    labelAr: "متاح للبيع",
    color: "green",
    badgeClass: "status-available",
    icon: `<svg width="10" height="10" viewBox="0 0 12 12" fill="none"><path d="M2.5 6L5 8.5L9.5 3.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`
  },
  reserved: {
    key: "reserved",
    label: "Reserved",
    labelAr: "محجوز بعربون",
    color: "amber",
    badgeClass: "status-reserved",
    icon: `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 3.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM2 8a6 6 0 1 1 12 0A6 6 0 0 1 2 8zm6-3a.75.75 0 0 1 .75.75v2.5l1.65 1.65a.75.75 0 0 1-1.06 1.06l-2-2A.75.75 0 0 1 7.25 8.75v-3A.75.75 0 0 1 8 5z"/></svg>`
  },
  sold: {
    key: "sold",
    label: "Sold",
    labelAr: "تم البيع والإفراغ",
    color: "red",
    badgeClass: "status-sold",
    icon: `<svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor"><path d="M8 1a3.5 3.5 0 0 0-3.5 3.5V6H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h8a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-.5V4.5A3.5 3.5 0 0 0 8 1zm2 5H6V4.5a2 2 0 1 1 4 0V6z"/></svg>`
  }
};

export function getStatusConfig(status) {
  return STATUS_CONFIG[status] || STATUS_CONFIG.available;
}

export function renderStatusBadgeHtml(status, extraClass = "") {
  const config = getStatusConfig(status);
  const isAr = typeof document !== 'undefined' && document.documentElement.lang === 'ar';
  const label = isAr ? (config.labelAr || config.label) : config.label;
  return `
    <span class="property-status-badge ${config.badgeClass} ${extraClass}" data-status="${config.key}">
      <span class="status-badge-dot"></span>
      <span class="status-badge-icon">${config.icon}</span>
      <span class="status-badge-label">${label}</span>
    </span>
  `;
}
