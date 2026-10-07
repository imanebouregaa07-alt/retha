/**
 * RETHA Real Estate — Supabase Storage Utility
 * Bucket: "property-images"
 */

export const STORAGE_CONFIG = {
  bucket: 'property-images',
  projectUrl: import.meta.env.VITE_SUPABASE_URL || 'https://aevssooayvieyhdnshse.supabase.co',
  maxSizeBytes: 5 * 1024 * 1024, // 5 MB
  allowedMimeTypes: ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'],
  allowedExtensions: ['jpg', 'jpeg', 'png', 'webp']
};

/**
 * Returns the public CDN URL for an image stored in the property-images bucket.
 * 
 * URL Format:
 * https://<project-ref>.supabase.co/storage/v1/object/public/property-images/<path>
 * 
 * @param {string} storagePath - Relative path inside the bucket, e.g. "villa-al-malqa/exterior/facade.webp"
 * @returns {string} Public direct-access URL
 */
export function getPropertyImageUrl(storagePath) {
  if (!storagePath) return '';
  // If it's already a full HTTP(S) URL or local path, return as is
  if (storagePath.startsWith('http://') || storagePath.startsWith('https://') || storagePath.startsWith('/')) {
    return storagePath;
  }
  const cleanPath = storagePath.replace(/^\/+/, '');
  return `${STORAGE_CONFIG.projectUrl}/storage/v1/object/public/${STORAGE_CONFIG.bucket}/${cleanPath}`;
}

/**
 * Constructs a standardized, organized storage path for property images.
 * 
 * Convention:
 * property-images/{property_id}/{category}/{filename}
 * 
 * @param {string} propertyId - UUID or slug of the property
 * @param {'exterior'|'interior'|'floorplan'|'aerial'} category - Image group
 * @param {string} filename - Clean filename (e.g. "hero_front.webp")
 * @returns {string} Standardized storage path
 */
export function buildPropertyStoragePath(propertyId, category = 'exterior', filename) {
  const cleanId = String(propertyId).trim().replace(/[^a-zA-Z0-9_-]/g, '');
  const cleanCat = String(category).trim().toLowerCase();
  const cleanFile = String(filename).trim().replace(/[^a-zA-Z0-9_\.-]/g, '_');
  return `${cleanId}/${cleanCat}/${cleanFile}`;
}

/**
 * Validates a file before upload against bucket constraints (5MB max, images only).
 * 
 * @param {File} file 
 * @returns {{ valid: boolean, error?: string }}
 */
export function validateImageUpload(file) {
  if (!file) {
    return { valid: false, error: 'No file selected.' };
  }
  if (!STORAGE_CONFIG.allowedMimeTypes.includes(file.type.toLowerCase())) {
    return { 
      valid: false, 
      error: `Invalid file type (${file.type}). Allowed formats: JPG, JPEG, PNG, WEBP.` 
    };
  }
  if (file.size > STORAGE_CONFIG.maxSizeBytes) {
    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    return { 
      valid: false, 
      error: `File size (${sizeMb} MB) exceeds maximum limit of 5 MB.` 
    };
  }
  return { valid: true };
}
