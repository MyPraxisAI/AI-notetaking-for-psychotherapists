-- Migration to drop the deprecated transcript column from sessions table
-- Since the transcript data is now stored in the dedicated transcripts table

-- Description: This migration removes the deprecated transcript column from the sessions table
-- as part of the transition to using the dedicated transcripts table for storing session transcripts.

-- Drop the column
ALTER TABLE public.sessions DROP COLUMN IF EXISTS transcript;

-- Update comment on table to reflect the change
COMMENT ON TABLE public.sessions IS 'Therapy sessions. Transcripts are stored in the transcripts table.';
