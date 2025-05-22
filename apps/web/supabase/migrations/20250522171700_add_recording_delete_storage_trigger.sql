-- Migration: Add trigger to delete recording files from storage when a recording is deleted
-- Description: This trigger will automatically delete audio files from Supabase storage
-- when a recording is deleted from the database, maintaining consistency between
-- database and storage.

-- Set the search path to include the storage schema
SET search_path TO public, storage;

-- Create a function to delete recording files from storage
CREATE OR REPLACE FUNCTION public.delete_recording_storage_files()
RETURNS TRIGGER AS $$
DECLARE
  bucket_name TEXT := 'recordings';
  recording_path TEXT;
  objects_deleted INTEGER := 0;
  prefixes_deleted INTEGER := 0;
BEGIN
  -- Construct the base path for the recording files
  -- Storage path format: {account_id}/{recording_id}/chunk-*.{extension}
  recording_path := OLD.account_id || '/' || OLD.id || '/';
  
  -- First, delete from the objects table directly
  -- This is the most direct way to remove the files from storage
  DELETE FROM storage.objects
  WHERE bucket_id = bucket_name
  AND name LIKE recording_path || '%';
  
  -- Get the number of objects deleted
  GET DIAGNOSTICS objects_deleted = ROW_COUNT;
  
  -- Clean up any prefixes
  DELETE FROM storage.prefixes
  WHERE bucket_id = bucket_name
  AND name = recording_path;
  
  -- Get the number of prefixes deleted
  GET DIAGNOSTICS prefixes_deleted = ROW_COUNT;
  
  -- Log the deletion for auditing purposes
  RAISE NOTICE 'Deleted % storage objects and % prefixes for account_id % and recording_id %', 
    objects_deleted, prefixes_deleted, OLD.account_id, OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create the trigger on the recordings table
DROP TRIGGER IF EXISTS delete_recording_storage_files_trigger ON public.recordings;

CREATE TRIGGER delete_recording_storage_files_trigger
AFTER DELETE ON public.recordings
FOR EACH ROW
EXECUTE FUNCTION public.delete_recording_storage_files();

-- Add a comment to the trigger for documentation
COMMENT ON TRIGGER delete_recording_storage_files_trigger ON public.recordings IS 
'Trigger to delete recording files from storage when a recording is deleted from the database';

-- Set up security for the function
-- Revoke execution from public
REVOKE ALL ON FUNCTION public.delete_recording_storage_files() FROM PUBLIC;

-- Grant execution to authenticated users
GRANT EXECUTE ON FUNCTION public.delete_recording_storage_files() TO service_role, authenticated;

-- Add comment to the function
COMMENT ON FUNCTION public.delete_recording_storage_files() IS
'Function to delete recording files from storage when a recording is deleted from the database';
