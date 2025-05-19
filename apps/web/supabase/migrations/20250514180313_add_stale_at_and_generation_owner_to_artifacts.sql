-- Migration: Add stale boolean column to artifacts table

-- 1. Add stale column (boolean, default false)
ALTER TABLE public.artifacts
  ADD COLUMN IF NOT EXISTS stale BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Add comment for the new column
COMMENT ON COLUMN public.artifacts.stale IS 'Flag indicating whether the artifact is stale and should be regenerated';

-- 3. Create index on stale for efficient queries on stale artifacts
CREATE INDEX IF NOT EXISTS ix_artifacts_stale
  ON public.artifacts (stale);
