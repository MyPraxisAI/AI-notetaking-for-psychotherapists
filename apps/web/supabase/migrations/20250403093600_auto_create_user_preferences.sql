-- Migration: Auto-create user preferences on account creation
-- Description: This migration adds a trigger to automatically create user preferences
-- when a new account is created in the accounts table.

-- First, create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.create_user_preferences_on_account_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create user preferences for personal accounts
  -- This ensures we don't create preferences for team accounts
  IF NEW.is_personal_account = TRUE THEN
    INSERT INTO public.user_preferences (account_id)
    VALUES (NEW.id);
    -- The default values will be used for use_24hr_clock, use_us_date_format, and language
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_user_preferences_on_account_creation IS 
  'Automatically creates user preferences when a new personal account is created';

-- Create the trigger that will call the function after an account is inserted
CREATE TRIGGER create_user_preferences_after_account_creation
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_preferences_on_account_creation();

COMMENT ON TRIGGER create_user_preferences_after_account_creation ON public.accounts IS
  'Trigger to automatically create user preferences when a new personal account is created';
