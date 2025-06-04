-- Migration: Redefine delete_recording_storage_files function
-- Description: This migration updates the public.delete_recording_storage_files function
-- to remove direct manipulation of the internal storage.prefixes table.
-- This addresses errors caused by potential changes in Supabase internal storage schema.

-- Set the search path to include the storage schema if not already set
-- Though generally, functions should be schema-qualified or rely on the user's search_path.
-- For safety, we ensure public is available.
SET search_path TO public, storage;

-- Redefine the function to delete recording files from storage
CREATE OR REPLACE FUNCTION public.delete_recording_storage_files()
RETURNS TRIGGER AS $$
DECLARE
  bucket_name TEXT := 'recordings';
  recording_path TEXT;
  objects_deleted INTEGER := 0;
BEGIN
  -- Construct the base path for the recording files
  -- Storage path format: {account_id}/{recording_id}/...
  recording_path := OLD.account_id || '/' || OLD.id || '/';
  
  -- Delete the recording's objects from storage.objects table
  DELETE FROM storage.objects
  WHERE bucket_id = bucket_name
  AND name LIKE recording_path || '%';
  
  -- Get the number of objects deleted
  GET DIAGNOSTICS objects_deleted = ROW_COUNT;
    
  -- Log the deletion for auditing purposes
  RAISE NOTICE 'Deleted % storage objects for account_id % and recording_id % from path %',
    objects_deleted, OLD.account_id, OLD.id, recording_path;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment to the function
COMMENT ON FUNCTION public.delete_recording_storage_files() IS
'Function to delete recording files from storage when a recording is deleted from the database.';

-- Ensure security for the function is correctly set
-- Revoke execution from public (if not already done, good practice to include)
REVOKE ALL ON FUNCTION public.delete_recording_storage_files() FROM PUBLIC;

-- Grant execution to service_role and authenticated (Makerkit pattern)
GRANT EXECUTE ON FUNCTION public.delete_recording_storage_files() TO service_role, authenticated;
