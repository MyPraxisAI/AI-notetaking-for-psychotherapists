-- Create recordings table
CREATE TYPE public.recording_status AS ENUM ('recording', 'paused', 'processing', 'completed', 'failed');

CREATE TABLE public.recordings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE,
    last_heartbeat_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    status public.recording_status NOT NULL DEFAULT 'recording',
    storage_bucket TEXT,
    storage_prefix TEXT
);

-- Add RLS policies for recordings
ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from public
REVOKE ALL ON TABLE public.recordings FROM PUBLIC;

-- Grant privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recordings TO authenticated;

-- Grant all privileges to service role
GRANT ALL ON TABLE public.recordings TO service_role;

-- Create RLS policies for recordings
CREATE POLICY "Accounts can access their own recordings"
    ON public.recordings
    FOR ALL
    USING (public.is_account_owner(account_id));


-- Create updated_at trigger for recordings
CREATE TRIGGER set_recordings_updated_at
BEFORE UPDATE ON public.recordings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for recordings
CREATE INDEX recordings_account_id_idx ON public.recordings (account_id);
CREATE INDEX recordings_client_id_idx ON public.recordings (client_id);
CREATE INDEX recordings_session_id_idx ON public.recordings (session_id);
CREATE INDEX recordings_status_idx ON public.recordings (status);

-- Create recordings_chunks table
CREATE TABLE public.recordings_chunks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    recording_id UUID NOT NULL REFERENCES public.recordings(id) ON DELETE CASCADE,
    start_time FLOAT NOT NULL,
    end_time FLOAT NOT NULL,
    chunk_number INT NOT NULL,
    storage_bucket TEXT NOT NULL,
    storage_path TEXT NOT NULL,
    transcript TEXT
);

-- Add RLS policies for recordings_chunks
ALTER TABLE public.recordings_chunks ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from public
REVOKE ALL ON TABLE public.recordings_chunks FROM PUBLIC;

-- Grant privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.recordings_chunks TO authenticated;

-- Grant all privileges to service role
GRANT ALL ON TABLE public.recordings_chunks TO service_role;

-- Create RLS policies for recordings_chunks
CREATE POLICY "Accounts can access their own recording chunks"
    ON public.recordings_chunks
    FOR ALL
    USING (public.is_account_owner(account_id));

-- Create updated_at trigger for recordings_chunks
CREATE TRIGGER set_recordings_chunks_updated_at
BEFORE UPDATE ON public.recordings_chunks
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add indexes for recordings_chunks
CREATE INDEX recordings_chunks_recording_id_idx ON public.recordings_chunks (recording_id);
CREATE INDEX recordings_chunks_time_range_idx ON public.recordings_chunks (start_time, end_time);
CREATE INDEX recordings_chunks_chunk_number_idx ON public.recordings_chunks (chunk_number);

-- Create function to extract the first folder component from a storage path
-- For paths like '{account_id}/{recording_id}/{filename}', this returns the account_id as UUID
CREATE OR REPLACE FUNCTION public.get_first_path_component_as_uuid(path text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
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

-- Grant execution permissions to service_role and authenticated
GRANT EXECUTE ON FUNCTION public.get_first_path_component_as_uuid(text) TO service_role, authenticated;

-- Create storage bucket for recording chunks
BEGIN;
  INSERT INTO storage.buckets (id, name, public, avif_autodetection, file_size_limit, allowed_mime_types)
  VALUES (
    'recordings',
    'recordings',
    false,
    false,
    104857600, -- 100MB file size limit
    ARRAY['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/ogg']
  )
  ON CONFLICT (id) DO NOTHING;

  -- Set up storage policy for authenticated users to access their own recordings
  -- Single policy for all operations
  -- This policy expects paths in the format: {account_id}/{recording_id}/{filename}
  -- Where {account_id} is the UUID of the account the user has access to
  CREATE POLICY "Accounts can access their own recordings"
    ON storage.objects
    FOR ALL
    TO authenticated
    USING (bucket_id = 'recordings' AND public.is_account_owner(public.get_first_path_component_as_uuid(name)))
    WITH CHECK (bucket_id = 'recordings' AND public.is_account_owner(public.get_first_path_component_as_uuid(name)));
END;
