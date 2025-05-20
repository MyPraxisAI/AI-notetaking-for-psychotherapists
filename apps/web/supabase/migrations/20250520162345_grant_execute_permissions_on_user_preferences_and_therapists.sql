-- Migration: Grant execute permissions on trigger functions
-- Description: This migration grants execute permissions to service_role for existing trigger functions
-- to ensure consistent permissions across all database functions.

-- Grant execute permissions on the user preferences trigger function
GRANT EXECUTE ON FUNCTION public.create_user_preferences_on_account_creation() TO service_role;

-- Grant execute permissions on the therapist trigger function
GRANT EXECUTE ON FUNCTION public.create_therapist_on_account_creation() TO service_role;

COMMENT ON FUNCTION public.create_user_preferences_on_account_creation IS 
  'Automatically creates user preferences when a new personal account is created';

COMMENT ON FUNCTION public.create_therapist_on_account_creation IS 
  'Automatically creates a therapist record when a new personal account is created';
