-- Create user_settings table for tracking user-specific settings like onboarding status
-- This follows the same pattern as user_preferences table

/*
 * -------------------------------------------------------
 * Section: User Settings
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  onboarding_completed BOOLEAN DEFAULT FALSE NOT NULL
);

-- Create updated_at trigger
CREATE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.user_settings IS 'User settings for application features and preferences';
COMMENT ON COLUMN public.user_settings.account_id IS 'The account these settings belong to';
COMMENT ON COLUMN public.user_settings.onboarding_completed IS 'Whether the user has completed the onboarding process';

-- RLS for user_settings
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
CREATE POLICY "Users can access their own settings"
  ON public.user_settings FOR ALL
  USING (public.is_account_owner(account_id));

-- Indexes
CREATE INDEX ix_user_settings_account_id ON public.user_settings (account_id);

-- Add unique constraint to account_id
ALTER TABLE public.user_settings 
  ADD CONSTRAINT user_settings_account_id_unique UNIQUE (account_id);

COMMENT ON CONSTRAINT user_settings_account_id_unique ON public.user_settings 
  IS 'Ensures each user can only have one settings record';

-- Revoke all privileges from public, authenticated, and service_role (we'll grant specific ones below)
REVOKE ALL ON public.user_settings FROM public, authenticated, service_role;

-- Grant appropriate privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_settings TO authenticated;

-- Grant all privileges to service_role
GRANT ALL PRIVILEGES ON public.user_settings TO service_role;

-- Auto-create user settings on account creation
-- First, create the function that will be called by the trigger
CREATE OR REPLACE FUNCTION public.create_user_settings_on_account_creation()
RETURNS TRIGGER AS $$
BEGIN
  -- Only create user settings for personal accounts
  -- This ensures we don't create settings for team accounts
  IF NEW.is_personal_account = TRUE THEN
    INSERT INTO public.user_settings (account_id)
    VALUES (NEW.id);
    -- The default values will be used for onboarding_completed (false)
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION public.create_user_settings_on_account_creation IS 
  'Automatically creates user settings when a new personal account is created';

-- Create the trigger that will call the function after an account is inserted
CREATE TRIGGER create_user_settings_after_account_creation
  AFTER INSERT ON public.accounts
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_settings_on_account_creation();

COMMENT ON TRIGGER create_user_settings_after_account_creation ON public.accounts IS
  'Trigger to automatically create user settings when a new personal account is created';

-- Grant execute permission on the function to service_role
GRANT EXECUTE ON FUNCTION public.create_user_settings_on_account_creation() TO service_role;

-- Create user_settings records for all existing personal accounts
INSERT INTO public.user_settings (account_id)
SELECT id FROM public.accounts
WHERE is_personal_account = TRUE
AND NOT EXISTS (
  SELECT 1 FROM public.user_settings WHERE account_id = accounts.id
);

COMMENT ON TABLE public.user_settings IS 'User settings for application features and preferences, including onboarding status';
