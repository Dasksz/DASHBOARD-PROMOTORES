-- ==============================================================================
-- STORAGE SETUP (Visitas Images)
-- Run this script in the Supabase SQL Editor to create the bucket and policies.
-- ==============================================================================

-- 1. Create 'visitas-images' bucket if it doesn't exist
INSERT INTO storage.buckets (id, name, public)
VALUES ('visitas-images', 'visitas-images', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Security (RLS) for Storage Objects
-- Note: storage.objects usually has RLS enabled by default.
-- We skip ALTER TABLE to avoid permission errors (42501) if not owner.

-- Allow authenticated uploads
DROP POLICY IF EXISTS "Authenticated users can upload images" ON storage.objects;
CREATE POLICY "Authenticated users can upload images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'visitas-images');

-- Allow public viewing (since bucket is public)
DROP POLICY IF EXISTS "Public can view images" ON storage.objects;
CREATE POLICY "Public can view images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'visitas-images');

-- Allow users to update their own files
DROP POLICY IF EXISTS "Users can update own images" ON storage.objects;
CREATE POLICY "Users can update own images"
ON storage.objects FOR UPDATE
TO authenticated
USING (bucket_id = 'visitas-images' AND auth.uid() = owner);

-- Allow users to delete their own files
DROP POLICY IF EXISTS "Users can delete own images" ON storage.objects;
CREATE POLICY "Users can delete own images"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'visitas-images' AND auth.uid() = owner);
