-- PostgreSQL has gen_random_uuid() built-in via pgcrypto which is enabled by default in Supabase

-- Create enum for invitation status
CREATE TYPE public.invite_status AS ENUM ('pending', 'accepted', 'revoked');

-- Create personal_invites table with proper relations
CREATE TABLE public.personal_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'), -- Default expiration: 7 days
  token TEXT NOT NULL,
  invited_by_account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  accepted_at TIMESTAMPTZ,
  invited_account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE,
  status public.invite_status NOT NULL DEFAULT 'pending'::public.invite_status,
  language TEXT NOT NULL DEFAULT 'en',
  
  -- Add a unique constraint on token to ensure it can only be used once
  CONSTRAINT personal_invites_token_key UNIQUE (token)
  
);

-- Create index for faster lookups by token
CREATE INDEX personal_invites_token_idx ON public.personal_invites(token);

-- Create index for faster lookups by email
CREATE INDEX personal_invites_email_idx ON public.personal_invites(email);

-- Create index for faster lookups by status
CREATE INDEX personal_invites_status_idx ON public.personal_invites(status);

-- Revoke all permissions on the personal_invites table
REVOKE ALL ON TABLE public.personal_invites FROM anon, authenticated;

-- Grant specific permissions
GRANT ALL ON TABLE public.personal_invites TO authenticated;

-- Grant full access to service_role (for backend services)
GRANT ALL ON TABLE public.personal_invites TO service_role;

-- Enable RLS on the personal_invites table
ALTER TABLE public.personal_invites ENABLE ROW LEVEL SECURITY;

-- Create policy for users to read their own invites (either the ones they were invited by or the ones they created)
CREATE POLICY read_own_personal_invites_policy ON public.personal_invites
  FOR SELECT
  TO authenticated
  USING (
    public.is_account_owner(invited_by_account_id) OR 
    public.is_account_owner(invited_account_id)
  );
  
-- Create policy for users to create and update personal invitations
-- Allow creation by the inviter
CREATE POLICY create_personal_invites_policy ON public.personal_invites
  FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_account_owner(invited_by_account_id)
  );
  
-- Update policy for personal invitations
-- Allow inviter to update their own invitations
CREATE POLICY update_personal_invites_inviter_policy ON public.personal_invites
  FOR UPDATE
  TO authenticated
  USING (
    public.is_account_owner(invited_by_account_id)
  );

-- Create a stored procedure to accept personal invites
-- This is necessary because the RLS policies prevent users from updating invitations
-- before their account ID is set on the invitation record

-- Create function to accept a personal invitation
CREATE OR REPLACE FUNCTION public.accept_personal_invite_by_token(
  token_param TEXT,
  account_id_param UUID
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  invite_status TEXT;
  update_succeeded INTEGER;
BEGIN
  -- Check if the invitation exists
  SELECT status
  FROM public.personal_invites
  WHERE token = token_param
  INTO invite_status;

  -- If invitation doesn't exist, return not_found
  IF invite_status IS NULL THEN
    RETURN 'not_found';
  END IF;

  -- If invitation is already accepted, return already_accepted
  IF invite_status = 'accepted' THEN
    RETURN 'already_accepted';
  END IF;

  -- Update the invitation
  UPDATE public.personal_invites
  SET 
    invited_account_id = account_id_param,
    status = 'accepted',
    accepted_at = now()
  WHERE token = token_param
    AND status = 'pending';
    
  -- Check if the update succeeded
  GET DIAGNOSTICS update_succeeded = ROW_COUNT;
  
  IF update_succeeded > 0 THEN
    RETURN 'success';
  ELSE
    RETURN 'failure';
  END IF;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.accept_personal_invite_by_token(TEXT, UUID) TO authenticated;

-- Add security comment
COMMENT ON FUNCTION public.accept_personal_invite_by_token IS 
  'Securely accepts a personal invitation by token, bypassing RLS restrictions';

-- Note: Public API functions for anonymous users are defined in a separate migration

-- Create policy for service role to have full access (for background workers)
CREATE POLICY service_role_personal_invites_policy ON public.personal_invites
  FOR ALL
  TO service_role
  USING (true);

-- No expiration trigger needed - we'll check expires_at directly in our queries

-- Add comments for documentation
COMMENT ON TABLE public.personal_invites IS 'Stores personal account invitations with secure tokens';
COMMENT ON COLUMN public.personal_invites.email IS 'Email address of the invited user';
COMMENT ON COLUMN public.personal_invites.token IS 'Secure token for accepting the invitation';
COMMENT ON COLUMN public.personal_invites.invited_by_account_id IS 'Account ID of the account that created the invitation';
COMMENT ON COLUMN public.personal_invites.status IS 'Current status of the invitation: pending, accepted or revoked';
