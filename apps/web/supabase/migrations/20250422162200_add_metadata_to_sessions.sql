-- Add metadata column to sessions table for tracking title generation status
ALTER TABLE public.sessions ADD COLUMN metadata JSONB DEFAULT '{}'::JSONB;

COMMENT ON COLUMN public.sessions.metadata IS 'Additional metadata for the session, including title generation status';

-- Create an index on metadata for better query performance with JSONB operators
CREATE INDEX ix_sessions_metadata_gin ON public.sessions USING GIN (metadata);

-- Create function to update metadata while preserving existing values
CREATE OR REPLACE FUNCTION public.update_session_metadata(
  p_session_id UUID,
  p_metadata JSONB
)
RETURNS VOID AS $$
BEGIN
  UPDATE public.sessions
  SET metadata = COALESCE(metadata, '{}'::JSONB) || p_metadata
  WHERE id = p_session_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.update_session_metadata TO authenticated;

COMMENT ON FUNCTION public.update_session_metadata IS 'Updates session metadata while preserving existing values';
