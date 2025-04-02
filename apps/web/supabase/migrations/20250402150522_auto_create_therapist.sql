-- Migration: Auto-create therapist record on account creation
-- Description: This migration adds a trigger to automatically create a therapist record
-- when a new account is created in the accounts table.

-- First, create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.create_therapist_on_account_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create a therapist record for personal accounts
  -- This ensures we don't create therapist records for team accounts
  IF NEW.is_personal_account = TRUE THEN
    INSERT INTO public.therapists (account_id)
    VALUES (NEW.id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_therapist_on_account_creation IS 
  'Automatically creates a therapist record when a new personal account is created';

-- Create the trigger that will call the function after an account is inserted
CREATE TRIGGER create_therapist_after_account_creation
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_therapist_on_account_creation();

COMMENT ON TRIGGER create_therapist_after_account_creation ON public.accounts IS
  'Trigger to automatically create a therapist record when a new personal account is created';
