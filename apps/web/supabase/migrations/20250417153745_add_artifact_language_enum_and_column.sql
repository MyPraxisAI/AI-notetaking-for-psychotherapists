-- Migration: add language enum, column, and index to artifacts

-- 1. Create enum type for artifact language (with safe creation check)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'language') THEN
    CREATE TYPE public."language" AS ENUM ('en', 'ru');
  END IF;
END$$;

-- 2. Add language column to artifacts table (default to 'en')
ALTER TABLE public.artifacts
  ADD COLUMN IF NOT EXISTS language public."language" NOT NULL DEFAULT 'en';

-- 3. Create index on reference_type, reference_id, type, and language for efficient lookups
CREATE INDEX IF NOT EXISTS ix_artifacts_reference_type_id_type_language
  ON public.artifacts (reference_type, reference_id, type, "language");
