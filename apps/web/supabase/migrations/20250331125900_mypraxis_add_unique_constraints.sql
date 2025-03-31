-- Migration to add unique constraints to account_id columns
-- This enables proper use of upsert operations with onConflict

/*
 * -------------------------------------------------------
 * Add unique constraint to user_preferences.account_id
 * -------------------------------------------------------
 */
ALTER TABLE public.user_preferences 
  ADD CONSTRAINT user_preferences_account_id_unique UNIQUE (account_id);

COMMENT ON CONSTRAINT user_preferences_account_id_unique ON public.user_preferences 
  IS 'Ensures each user can only have one preferences record';

/*
 * -------------------------------------------------------
 * Add unique constraint to therapists.account_id
 * -------------------------------------------------------
 */
ALTER TABLE public.therapists 
  ADD CONSTRAINT therapists_account_id_unique UNIQUE (account_id);

COMMENT ON CONSTRAINT therapists_account_id_unique ON public.therapists 
  IS 'Ensures each account can only have one therapist profile';
