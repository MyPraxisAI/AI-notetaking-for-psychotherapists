-- Migration: Add transcripts table
-- Created at: 2025-04-29 15:33:00

/*
 * -------------------------------------------------------
 * Section: Transcripts
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.transcripts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  session_id UUID REFERENCES public.sessions(id) ON DELETE CASCADE NOT NULL,
  transcription_model VARCHAR(128),
  content TEXT
);

-- Add comments to the table and columns
COMMENT ON TABLE public.transcripts IS 'Session transcripts';
COMMENT ON COLUMN public.transcripts.account_id IS 'The account this transcript belongs to';
COMMENT ON COLUMN public.transcripts.session_id IS 'The session this transcript is for';
COMMENT ON COLUMN public.transcripts.transcription_model IS 'The model used for transcription (e.g., whisper-1, gpt-4o-audio-preview)';
COMMENT ON COLUMN public.transcripts.content IS 'The transcript content';

-- Add indexes for performance
CREATE INDEX ix_transcripts_account_id ON public.transcripts (account_id);
CREATE INDEX ix_transcripts_session_id ON public.transcripts (session_id);

-- Add unique constraint to ensure only one transcript per session
ALTER TABLE public.transcripts ADD CONSTRAINT unique_session_transcript UNIQUE (session_id);

-- Enable Row Level Security
ALTER TABLE public.transcripts ENABLE ROW LEVEL SECURITY;

-- Create RLS policy for transcripts
-- Users can only access transcripts in accounts they belong to
CREATE POLICY "Users can access transcripts in their accounts"
  ON public.transcripts FOR ALL
  USING (public.is_account_owner(account_id));

-- Copy existing transcript data from sessions table
INSERT INTO public.transcripts (account_id, session_id, transcription_model, content)
SELECT 
  account_id,
  id AS session_id,
  'external' AS transcription_model,
  transcript AS content
FROM 
  public.sessions
WHERE 
  transcript IS NOT NULL AND transcript != '';

-- Add trigger to automatically update the updated_at column
CREATE TRIGGER set_transcripts_updated_at
BEFORE UPDATE ON public.transcripts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

/*
 * -------------------------------------------------------
 * Section: Revocations and Grants
 * -------------------------------------------------------
 */

-- Revoke all privileges from public, authenticated, and service_role
REVOKE ALL ON public.transcripts FROM public, authenticated, service_role;

-- Grant appropriate privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.transcripts TO authenticated;

-- Grant all privileges to service_role
GRANT ALL ON public.transcripts TO service_role;
