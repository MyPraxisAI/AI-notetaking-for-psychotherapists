-- Add transcription_engine column to recordings table
ALTER TABLE public.recordings ADD COLUMN transcription_engine VARCHAR(256);

-- Add comment to the column
COMMENT ON COLUMN public.recordings.transcription_engine IS 'Identifies which transcription engine was used (e.g., "yandex-v3", "openai-whisper")';
