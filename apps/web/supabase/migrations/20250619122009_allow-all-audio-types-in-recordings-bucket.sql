-- Migration to allow all audio types in the recordings bucket
-- This removes the MIME type restrictions, allowing any audio format to be uploaded

-- Update the recordings bucket to allow all MIME types
UPDATE storage.buckets
SET allowed_mime_types = NULL
WHERE id = 'recordings';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Removed MIME type restrictions from recordings bucket';
END $$;
