-- Migration to create a separate schema for public-facing API functions
-- This follows security best practices by limiting anonymous access to only necessary functionality
-- while maintaining strong security boundaries

-- Create the anonymous schema for functions accessible by unauthenticated users
CREATE SCHEMA IF NOT EXISTS anonymous;

-- Grant usage on just this schema to anonymous and authenticated users
GRANT USAGE ON SCHEMA anonymous TO anon, authenticated;

-- Create a secure token validation function in the anonymous schema
-- This function returns only the minimal necessary data (not the entire invitation record)
CREATE OR REPLACE FUNCTION anonymous.get_invite_by_token(token_param TEXT)
RETURNS TABLE (
  email TEXT,
  valid BOOLEAN,
  language TEXT
) 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, anonymous
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    i.email,
    TRUE as valid,
    i.language
  FROM public.personal_invites i
  WHERE i.token = token_param
    AND i.status = 'pending'
    AND i.expires_at > now();
    
  -- If no rows are returned, return a single row with valid = false
  IF NOT FOUND THEN
    RETURN QUERY SELECT NULL::TEXT, FALSE, NULL::TEXT;
  END IF;
END;
$$;

-- Grant execute permission on just this function to anonymous and authenticated users
GRANT EXECUTE ON FUNCTION anonymous.get_invite_by_token TO anon, authenticated;

COMMENT ON SCHEMA anonymous IS 'Schema for functions accessible to unauthenticated users';
COMMENT ON FUNCTION anonymous.get_invite_by_token IS 'Secure function to validate invitation tokens without exposing internal data';
