-- Make the language column in user_preferences nullable and default to NULL
-- This allows the system to detect language from browser preferences when no explicit preference is set

-- Drop the NOT NULL constraint and change the default value to NULL
ALTER TABLE public.user_preferences 
  ALTER COLUMN language DROP NOT NULL,
  ALTER COLUMN language DROP DEFAULT;

-- Update the comment to reflect the new behavior
COMMENT ON COLUMN public.user_preferences.language IS 'Preferred language (NULL means use browser preference)';

-- Update existing records with 'en' to NULL to use browser detection
UPDATE public.user_preferences SET language = NULL WHERE language = 'en';
