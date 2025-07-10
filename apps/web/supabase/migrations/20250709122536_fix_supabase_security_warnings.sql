-- There is a warning about SECURITY DEFINER on public.admin_accounts_with_stats view
-- But it's a false positive, ignoring it - it's not possible for Supabase views to have SECURITY DEFINER.

-- For 18 stored procedures there were Supabase warnings that their search_path needs to be set

-- Fix: Set search_path in header for handle_updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- Fix: Set search_path in header for update_session_metadata
CREATE OR REPLACE FUNCTION public.update_session_metadata(
  p_session_id UUID,
  p_metadata JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  UPDATE public.sessions
  SET metadata = COALESCE(metadata, '{}'::JSONB) || p_metadata
  WHERE id = p_session_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_session_metadata(UUID, JSONB) TO authenticated;

COMMENT ON FUNCTION public.update_session_metadata(UUID, JSONB) IS 'Updates session metadata while preserving existing values.';

-- Fix: Set search_path in header for get_first_path_component_as_uuid
CREATE OR REPLACE FUNCTION public.get_first_path_component_as_uuid(path text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
    _parts text[];
BEGIN
    -- Split on "/" to get path segments
    SELECT string_to_array(path, '/') INTO _parts;
    -- Return the first segment as UUID
    RETURN _parts[1]::uuid;
EXCEPTION
    WHEN others THEN
        RETURN NULL::uuid;
END
$$;

GRANT EXECUTE ON FUNCTION public.get_first_path_component_as_uuid(text) TO service_role, authenticated;

-- Fix: Set search_path in header for validate_transcript_segments
CREATE OR REPLACE FUNCTION public.validate_transcript_segments(data jsonb)
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  segment_count integer;
  segment jsonb;
  segments jsonb;
BEGIN
  -- Allow NULL values for backward compatibility with existing data
  IF data IS NULL THEN
    RETURN TRUE;
  END IF;
  
  -- Check if data doesn't have segments property
  IF NOT (data ? 'segments') THEN
    RETURN FALSE;
  END IF;
  
  -- Check if segments is an array
  IF jsonb_typeof(data->'segments') != 'array' THEN
    RETURN FALSE;
  END IF;
  
  -- Get segments array
  segments := data->'segments';
  segment_count := jsonb_array_length(segments);
  
  -- If empty array, it's valid
  IF segment_count = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- Check each segment for required fields
  FOR i IN 0..(segment_count-1) LOOP
    segment := segments->i;
    
    -- Check if segment is an object
    IF jsonb_typeof(segment) != 'object' THEN
      RETURN FALSE;
    END IF;
    
    -- Check required fields exist
    IF NOT (segment ? 'start_ms' AND segment ? 'end_ms' AND 
            segment ? 'speaker' AND segment ? 'content') THEN
      RETURN FALSE;
    END IF;
    
    -- Check field types
    IF jsonb_typeof(segment->'start_ms') != 'number' OR 
       jsonb_typeof(segment->'end_ms') != 'number' OR
       jsonb_typeof(segment->'speaker') != 'string' OR
       jsonb_typeof(segment->'content') != 'string' THEN
      RETURN FALSE;
    END IF;
    
    -- Check speaker is either 'therapist' or 'client'
    IF (segment->>'speaker') != 'therapist' AND 
       (segment->>'speaker') != 'client' THEN
      RETURN FALSE;
    END IF;
  END LOOP;
  
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.validate_transcript_segments(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.validate_transcript_segments(jsonb) TO authenticated, service_role;

-- Fix: Set search_path in header for create_user_preferences_on_account_creation
CREATE OR REPLACE FUNCTION public.create_user_preferences_on_account_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only create user preferences for personal accounts
  -- This ensures we don't create preferences for team accounts
  IF NEW.is_personal_account = TRUE THEN
    INSERT INTO public.user_preferences (account_id)
    VALUES (NEW.id);
    -- The default values will be used for use_24hr_clock, use_us_date_format, and language
  END IF;
  
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_user_preferences_on_account_creation() TO service_role;

-- Fix: Set search_path in header for create_therapist_on_account_creation
CREATE OR REPLACE FUNCTION public.create_therapist_on_account_creation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Only create a therapist record for personal accounts
  -- This ensures we don't create therapist records for team accounts
  IF NEW.is_personal_account = TRUE THEN
    INSERT INTO public.therapists (account_id)
    VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_therapist_on_account_creation() TO service_role;

-- Fix: Set search_path in header for delete_recording_storage_files
CREATE OR REPLACE FUNCTION public.delete_recording_storage_files()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
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
$$;

COMMENT ON FUNCTION public.delete_recording_storage_files() IS
'Function to delete recording files from storage when a recording is deleted from the database.';
REVOKE ALL ON FUNCTION public.delete_recording_storage_files() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.delete_recording_storage_files() TO service_role, authenticated;

-- Fix: Set search_path in header for create_demo_client
CREATE OR REPLACE FUNCTION public.create_demo_client(
  p_target_account_id UUID,
  p_source_client_id UUID
) RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  new_client_id UUID;
  session_record RECORD;
  new_session_id UUID;
BEGIN
  -- First, get the therapist ID for the account
  DECLARE
    target_therapist_id UUID;
  BEGIN
    -- Find the therapist ID for the target account
    SELECT id INTO target_therapist_id
    FROM public.therapists
    WHERE account_id = p_target_account_id
    LIMIT 1;
    
    -- If no therapist found, raise an exception
    IF target_therapist_id IS NULL THEN
      RAISE EXCEPTION 'No therapist found for account ID %', p_target_account_id;
    END IF;
    
    -- 1. Copy the client record with the correct therapist_id
    INSERT INTO public.clients (
      account_id,
      therapist_id,
      full_name,
      email,
      phone,
      demo,
      created_at,
      updated_at
    )
    SELECT 
      p_target_account_id,
      target_therapist_id,  -- Use the therapist ID we found
      full_name,
      email,
      phone,
      true,
      NOW(),
      NOW()
    FROM public.clients
    WHERE id = p_source_client_id
    RETURNING id INTO new_client_id;
  END;
  
  -- 2. Copy all client artifacts
  INSERT INTO public.artifacts (
    account_id,
    reference_type,
    reference_id,
    type,
    content,
    language,
    stale,
    created_at,
    updated_at
  )
  SELECT
    p_target_account_id,
    reference_type,
    new_client_id,
    type,
    content,
    language,
    false, -- Set stale to false for new artifacts
    NOW(),
    NOW()
  FROM public.artifacts
  WHERE reference_type = 'client' AND reference_id = p_source_client_id;
  
  -- 3. Copy all sessions and related data
  FOR session_record IN
    SELECT id
    FROM public.sessions
    WHERE client_id = p_source_client_id
  LOOP
    -- 3a. Copy the session
    INSERT INTO public.sessions (
      account_id,
      client_id,
      title,
      note,
      metadata,
      created_at,
      updated_at
    )
    SELECT
      p_target_account_id,
      new_client_id,
      title,
      note,
      jsonb_build_object('title_initialized', true),  -- Set metadata to { "title_initialized": true }
      NOW(),
      NOW()
    FROM public.sessions
    WHERE id = session_record.id
    RETURNING id INTO new_session_id;
    
    -- 4. Copy all transcripts for the session
    INSERT INTO public.transcripts (
      account_id,
      session_id,
      transcription_model,
      content,
      content_json,
      created_at,
      updated_at
    )
    SELECT
      p_target_account_id,
      new_session_id,
      transcription_model,
      content,
      content_json,
      NOW(),
      NOW()
    FROM public.transcripts
    WHERE session_id = session_record.id;
    
    -- 5. Copy all artifacts for the session
    INSERT INTO public.artifacts (
      account_id,
      reference_type,
      reference_id,
      type,
      content,
      language,
      stale,
      created_at,
      updated_at
    )
    SELECT
      p_target_account_id,
      reference_type,
      new_session_id,
      type,
      content,
      language,
      false, -- Set stale to false for new artifacts
      NOW(),
      NOW()
    FROM public.artifacts
    WHERE reference_type = 'session' AND reference_id = session_record.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_demo_client(UUID, UUID) TO authenticated, service_role;
COMMENT ON FUNCTION public.create_demo_client(UUID, UUID) IS 'Creates a demo client and all related data in a user''s account';

-- Fix: Set search_path in header for delete_client_artifacts
CREATE OR REPLACE FUNCTION public.delete_client_artifacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Delete artifacts associated with this client
  DELETE FROM public.artifacts
  WHERE reference_type = 'client' AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.delete_client_artifacts() IS 'Deletes artifacts associated with a client when the client is deleted';

-- Fix: Set search_path in header for delete_session_artifacts
CREATE OR REPLACE FUNCTION public.delete_session_artifacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Delete artifacts associated with this session
  DELETE FROM public.artifacts
  WHERE reference_type = 'session' AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.delete_session_artifacts() IS 'Deletes artifacts associated with a session when the session is deleted';

-- Fix: Set search_path in header for delete_therapist_artifacts
CREATE OR REPLACE FUNCTION public.delete_therapist_artifacts()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Delete artifacts associated with this therapist
  DELETE FROM public.artifacts
  WHERE reference_type = 'therapist' AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$;

COMMENT ON FUNCTION public.delete_therapist_artifacts() IS 'Deletes artifacts associated with a therapist when the therapist is deleted';

-- Fix: Set search_path in header for update_transcript_duration
CREATE OR REPLACE FUNCTION public.update_transcript_duration()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.duration_ms := get_last_segment_end_ms(NEW.content_json);
  RETURN NEW;
END;
$$;

-- Fix: Set search_path in header for update_updated_at_column
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Fix: Set search_path in header for ensure_therapist_approach_account_id
CREATE OR REPLACE FUNCTION public.ensure_therapist_approach_account_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Set account_id to match the therapist's account_id
  NEW.account_id := (SELECT account_id FROM public.therapists WHERE id = NEW.therapist_id);
  RETURN NEW;
END;
$$;

-- Fix: Set search_path in header for set_client_account_id
CREATE OR REPLACE FUNCTION public.set_client_account_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.therapists WHERE id = NEW.therapist_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix: Set search_path in header for set_session_account_id
CREATE OR REPLACE FUNCTION public.set_session_account_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix: Set search_path in header for set_artifact_account_id
CREATE OR REPLACE FUNCTION public.set_artifact_account_id()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    CASE NEW.reference_type
      WHEN 'client' THEN
        SELECT account_id INTO NEW.account_id FROM public.clients WHERE id = NEW.reference_id;
      WHEN 'session' THEN
        SELECT account_id INTO NEW.account_id FROM public.sessions WHERE id = NEW.reference_id;
      WHEN 'therapist' THEN
        SELECT account_id INTO NEW.account_id FROM public.therapists WHERE id = NEW.reference_id;
      ELSE
        -- For other reference types, account_id must be provided
        RAISE EXCEPTION 'account_id must be provided for reference_type %', NEW.reference_type;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$;

-- Fix: Set search_path in header for validate_artifact_reference
CREATE OR REPLACE FUNCTION public.validate_artifact_reference()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Check that the reference exists in the appropriate table
  IF NEW.reference_type = 'client' THEN
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Referenced client does not exist';
    END IF;
  ELSIF NEW.reference_type = 'session' THEN
    IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Referenced session does not exist';
    END IF;
  ELSIF NEW.reference_type = 'therapist' THEN
    IF NOT EXISTS (SELECT 1 FROM public.therapists WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Referenced therapist does not exist';
    END IF;
  END IF;
  
  -- Ensure account_id consistency
  IF NEW.reference_type = 'client' THEN
    IF NEW.account_id != (SELECT account_id FROM public.clients WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Artifact account_id must match referenced client account_id';
    END IF;
  ELSIF NEW.reference_type = 'session' THEN
    IF NEW.account_id != (SELECT account_id FROM public.sessions WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Artifact account_id must match referenced session account_id';
    END IF;
  ELSIF NEW.reference_type = 'therapist' THEN
    IF NEW.account_id != (SELECT account_id FROM public.therapists WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Artifact account_id must match referenced therapist account_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;
