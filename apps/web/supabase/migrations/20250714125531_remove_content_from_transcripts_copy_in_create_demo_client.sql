-- Migration: Remove 'content' column from transcripts copy in create_demo_client
-- Created at: 2025-07-14 12:55:31

-- Replace the create_demo_client function to no longer reference the 'content' column in transcripts
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
      target_therapist_id,
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
    false,
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
      jsonb_build_object('title_initialized', true),
      NOW(),
      NOW()
    FROM public.sessions
    WHERE id = session_record.id
    RETURNING id INTO new_session_id;
    -- 4. Copy all transcripts for the session (remove 'content' column)
    INSERT INTO public.transcripts (
      account_id,
      session_id,
      transcription_model,
      content_json,
      created_at,
      updated_at
    )
    SELECT
      p_target_account_id,
      new_session_id,
      transcription_model,
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
      false,
      NOW(),
      NOW()
    FROM public.artifacts
    WHERE reference_type = 'session' AND reference_id = session_record.id;
  END LOOP;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_demo_client(UUID, UUID) TO authenticated, service_role;
COMMENT ON FUNCTION public.create_demo_client(UUID, UUID) IS 'Creates a demo client and all related data in a user''s account';
