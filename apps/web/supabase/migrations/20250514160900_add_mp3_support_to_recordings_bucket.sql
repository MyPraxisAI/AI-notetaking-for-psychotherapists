-- Migration to add MP3 support to the recordings bucket
-- Add 'audio/mpeg' to the allowed MIME types for the recordings bucket

-- Update the allowed_mime_types for the recordings bucket
UPDATE storage.buckets
SET allowed_mime_types = array_append(allowed_mime_types, 'audio/mpeg')
WHERE id = 'recordings';

-- Log the change
DO $$
BEGIN
  RAISE NOTICE 'Added audio/mpeg support to recordings bucket';
END $$;
