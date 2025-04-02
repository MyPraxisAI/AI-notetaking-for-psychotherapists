-- Add title column to sessions table
ALTER TABLE public.sessions ADD COLUMN title VARCHAR(255);

COMMENT ON COLUMN public.sessions.title IS 'The title of the session';

-- Create an index on title for better query performance
CREATE INDEX ix_sessions_title ON public.sessions (title);
