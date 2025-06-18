-- Migration: Add timestamps trigger to accounts table
-- Description: This migration adds a trigger to automatically set created_at and updated_at timestamps
-- on the accounts table.

-- Create the trigger that will call the function before insert or update
CREATE TRIGGER set_timestamps_trigger
  BEFORE INSERT OR UPDATE ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_set_timestamps();

COMMENT ON TRIGGER set_timestamps_trigger ON public.accounts IS
  'Trigger to automatically set created_at and updated_at timestamps';

-- Update existing rows to set timestamps if they are null (handling each column separately)
UPDATE public.accounts
SET created_at = CURRENT_TIMESTAMP
WHERE created_at IS NULL;

UPDATE public.accounts
SET updated_at = CURRENT_TIMESTAMP
WHERE updated_at IS NULL; 