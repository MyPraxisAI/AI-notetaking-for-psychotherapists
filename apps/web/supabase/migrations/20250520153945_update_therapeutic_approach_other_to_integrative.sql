-- Update the 'other' therapeutic approach to 'int'/'Integrative Therapy'
-- This migration changes the existing 'other' approach to be more specific

-- Update the therapeutic approach with ID b9999999-9999-4999-b999-999999999999
UPDATE public.therapeutic_approaches
SET 
  name = 'int',
  title = 'Integrative Therapy',
  updated_at = now()
WHERE id = 'b9999999-9999-4999-b999-999999999999';

-- Add a comment explaining the change
COMMENT ON TABLE public.therapeutic_approaches IS 'Therapeutic approaches used by therapists. The ''int'' approach represents Integrative Therapy.';
