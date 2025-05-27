-- Migration to add cascade delete triggers for polymorphic artifacts

-- Create a function to delete artifacts when a client is deleted
CREATE OR REPLACE FUNCTION public.delete_client_artifacts()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete artifacts associated with this client
  DELETE FROM public.artifacts
  WHERE reference_type = 'client' AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create a function to delete artifacts when a session is deleted
CREATE OR REPLACE FUNCTION public.delete_session_artifacts()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete artifacts associated with this session
  DELETE FROM public.artifacts
  WHERE reference_type = 'session' AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create a function to delete artifacts when a therapist is deleted
CREATE OR REPLACE FUNCTION public.delete_therapist_artifacts()
RETURNS TRIGGER AS $$
BEGIN
  -- Delete artifacts associated with this therapist
  DELETE FROM public.artifacts
  WHERE reference_type = 'therapist' AND reference_id = OLD.id;
  
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to call these functions before deletion
CREATE TRIGGER delete_client_artifacts_trigger
BEFORE DELETE ON public.clients
FOR EACH ROW
EXECUTE FUNCTION public.delete_client_artifacts();

CREATE TRIGGER delete_session_artifacts_trigger
BEFORE DELETE ON public.sessions
FOR EACH ROW
EXECUTE FUNCTION public.delete_session_artifacts();

CREATE TRIGGER delete_therapist_artifacts_trigger
BEFORE DELETE ON public.therapists
FOR EACH ROW
EXECUTE FUNCTION public.delete_therapist_artifacts();

-- Add a comment explaining the purpose of these triggers
COMMENT ON FUNCTION public.delete_client_artifacts() IS 'Deletes artifacts associated with a client when the client is deleted';
COMMENT ON FUNCTION public.delete_session_artifacts() IS 'Deletes artifacts associated with a session when the session is deleted';
COMMENT ON FUNCTION public.delete_therapist_artifacts() IS 'Deletes artifacts associated with a therapist when the therapist is deleted';
