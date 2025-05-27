-- Migration to add a "demo" column to the clients table and create a demo user account
-- This will be used for demonstration purposes

-- Part 1: Add the demo column to clients table with default value of false
ALTER TABLE public.clients
ADD COLUMN demo BOOLEAN NOT NULL DEFAULT false;

-- Add comment to explain the purpose of the column
COMMENT ON COLUMN public.clients.demo IS 'Indicates whether this is a demo client for testing purposes';

-- Create an index on the demo column for efficient filtering
CREATE INDEX ix_clients_demo ON public.clients (demo);

-- Part 2: Create a demo user account

-- Add the demo user to auth.users
INSERT INTO "auth"."users" (
  "instance_id", "id", "aud", "role", "email", "encrypted_password", 
  "email_confirmed_at", "invited_at", "confirmation_token", "confirmation_sent_at", 
  "recovery_token", "recovery_sent_at", "email_change_token_new", "email_change", 
  "email_change_sent_at", "last_sign_in_at", "raw_app_meta_data", "raw_user_meta_data", 
  "is_super_admin", "created_at", "updated_at", "phone", "phone_confirmed_at", 
  "phone_change", "phone_change_token", "phone_change_sent_at", 
  "email_change_token_current", "email_change_confirm_status", "banned_until", 
  "reauthentication_token", "reauthentication_sent_at", "is_sso_user", 
  "deleted_at", "is_anonymous"
)
-- Password for demo@mypraxis.ai is 'SofaSoGood37!'
VALUES (
  '00000000-0000-0000-0000-000000000000', 
  'dddddddd-dddd-4ddd-addd-dddddddddddd', 
  'authenticated', 
  'authenticated', 
  'demo@mypraxis.ai', 
  '$2a$10$H4NXpQWiC2Du6cIS.iGxoetn0FvtCoD.XWiJrEGH0s9wgALvCyuAq', 
  NOW(), 
  null, 
  '', 
  NOW() - INTERVAL '1 minute', 
  '', 
  null, 
  '', 
  '', 
  null, 
  NOW(), 
  '{"provider": "email", "providers": ["email"]}', 
  '{"sub": "dddddddd-dddd-4ddd-addd-dddddddddddd", "email": "demo@mypraxis.ai", "email_verified": true, "phone_verified": false}', 
  null, 
  NOW() - INTERVAL '10 minutes', 
  NOW(), 
  null, 
  null, 
  '', 
  '', 
  null, 
  '', 
  0, 
  NULL, 
  '', 
  NULL, 
  false, 
  NULL, 
  false
);

-- Add the demo user identity
INSERT INTO "auth"."identities" (
  "id", "user_id", "identity_data", "provider", "provider_id", 
  "last_sign_in_at", "created_at", "updated_at"
)
VALUES (
  'dddddddd-dddd-4ddd-addd-dddddddddddd', 
  'dddddddd-dddd-4ddd-addd-dddddddddddd', 
  '{"sub": "dddddddd-dddd-4ddd-addd-dddddddddddd", "email": "demo@mypraxis.ai", "email_verified": true, "phone_verified": false}', 
  'email', 
  'demo@mypraxis.ai', 
  NOW() - INTERVAL '10 minutes', 
  NOW() - INTERVAL '10 minutes', 
  NOW() - INTERVAL '10 minutes'
);

-- Note: The personal account will be automatically created by Makerkit
-- Note: User preferences and therapist record will be automatically created by triggers

-- Update the preferences for the demo account once it's created
-- We need to wait for the account to be created by the Makerkit trigger
DO $$
DECLARE
  demo_account_id UUID;
BEGIN
  -- Wait a bit for the account to be created
  PERFORM pg_sleep(1);
  
  -- Get the account ID for the demo user
  SELECT id INTO demo_account_id FROM public.accounts 
  WHERE primary_owner_user_id = 'dddddddd-dddd-4ddd-addd-dddddddddddd' AND is_personal_account = true;
  
  -- Update user preferences
  UPDATE public.user_preferences
  SET 
    use_24hr_clock = true, 
    use_us_date_format = false, 
    language = 'en',
    updated_at = NOW()
  WHERE account_id = demo_account_id;
  
  -- Update therapist record
  UPDATE public.therapists 
  SET 
    full_professional_name = 'Demo Therapist',
    credentials = 'Licensed Clinical Psychologist', 
    geo_locality_id = '22222222-2222-4222-a222-222222222222', -- US
    updated_at = NOW()
  WHERE account_id = demo_account_id;
  
  -- Add therapeutic approaches for the demo therapist
  INSERT INTO public.therapists_approaches (
    account_id, therapist_id, approach_id, priority
  )
  SELECT 
    demo_account_id,
    t.id,
    a.id,
    CASE WHEN a.name = 'pdt' THEN 0 ELSE 1 END -- PDT as primary approach, INT as secondary
  FROM 
    public.therapists t,
    public.therapeutic_approaches a
  WHERE 
    t.account_id = demo_account_id
    AND a.name IN ('pdt', 'int');
END
$$;

