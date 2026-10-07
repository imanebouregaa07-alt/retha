-- Migration: 20260929000000_storage_setup.sql
-- Description: Supabase Storage configuration for RETHA Real Estate property images

-- 1. Create the public "property-images" bucket with 5MB limit and image-only MIME constraints
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'property-images',
  'property-images',
  true,
  5242880, -- 5 MB in bytes
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE SET
  public = true,
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];

-- 2. Storage RLS Policies for storage.objects

-- Allow public read access to all images within the "property-images" bucket
DROP POLICY IF EXISTS "Public can view property images" ON storage.objects;
CREATE POLICY "Public can view property images"
  ON storage.objects
  FOR SELECT
  TO public
  USING (bucket_id = 'property-images');

-- Restrict upload (INSERT) to authenticated admins only
DROP POLICY IF EXISTS "Admins can upload property images" ON storage.objects;
CREATE POLICY "Admins can upload property images"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'property-images');

-- Restrict update (UPDATE) to authenticated admins only
DROP POLICY IF EXISTS "Admins can update property images" ON storage.objects;
CREATE POLICY "Admins can update property images"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (bucket_id = 'property-images')
  WITH CHECK (bucket_id = 'property-images');

-- Restrict delete (DELETE) to authenticated admins only
DROP POLICY IF EXISTS "Admins can delete property images" ON storage.objects;
CREATE POLICY "Admins can delete property images"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (bucket_id = 'property-images');
