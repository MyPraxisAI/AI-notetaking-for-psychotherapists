-- Create ENUM for action_type
CREATE TYPE public.audit_action_type AS ENUM ('CREATE', 'READ', 'UPDATE', 'DELETE');

-- Create audit_log table
CREATE TABLE public.audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    acting_user_id UUID NOT NULL,
    account_id UUID NOT NULL,
    action_type public.audit_action_type NOT NULL,
    table_name TEXT NOT NULL,
    record_id UUID,
    ip_address INET,
    phi_accessed BOOLEAN DEFAULT FALSE,
    access_reason TEXT,
    details JSONB,
    changes JSONB,
    application TEXT
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS audit_log_user_id_timestamp_idx ON public.audit_log (acting_user_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_log_account_id_timestamp_idx ON public.audit_log (account_id, timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_log_table_name_idx ON public.audit_log (table_name);
CREATE INDEX IF NOT EXISTS audit_log_timestamp_idx ON public.audit_log (timestamp DESC);
CREATE INDEX IF NOT EXISTS audit_log_phi_accessed_idx ON public.audit_log (phi_accessed);

-- Enable Row Level Security
ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Revoke all privileges from all common roles
REVOKE ALL ON public.audit_log FROM PUBLIC, authenticated, anon;

-- action_type=READ are only allowed to be inserted by service_role from app code
-- action_type=CREATE, UPDATE, DELETE are inserted via triggers (with security definer)

-- Policy: Only service_role can read all audit_log rows
CREATE POLICY "audit_log_read_service_role" ON public.audit_log
  FOR SELECT TO service_role
  USING (true);

-- Policy: Only service_role can insert into audit_log for action_type=READ or table_name='auth.users'
CREATE POLICY "audit_log_insert_service_role" ON public.audit_log
  FOR INSERT TO service_role
  WITH CHECK (
    action_type = 'READ'
    OR table_name = 'auth.users'
  );

-- SECURITY DEFINER trigger function for audit logging
CREATE OR REPLACE FUNCTION public.audit_log_trigger_fn()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_account_id UUID;
BEGIN
  SET search_path = public, pg_temp;

  v_account_id := (to_jsonb(COALESCE(NEW, OLD)) ->> 'account_id')::uuid;

  INSERT INTO public.audit_log (
    acting_user_id,
    account_id,
    action_type,
    table_name,
    record_id,
    phi_accessed,
    access_reason,
    details,
    application,
    changes
  ) VALUES (
    COALESCE(auth.uid(), '00000000-0000-0000-0000-000000000000'::uuid),
    v_account_id,
    (CASE TG_OP
      WHEN 'INSERT' THEN 'CREATE'
      WHEN 'UPDATE' THEN 'UPDATE'
      WHEN 'DELETE' THEN 'DELETE'
    END)::public.audit_action_type,
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    true,
    NULL,
    NULL,
    'database-triggers',
    NULL
  );
  RETURN NULL;
END;
$$;

-- Triggers for clients
CREATE TRIGGER audit_log_clients_insert
AFTER INSERT ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_log_clients_update
AFTER UPDATE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_log_clients_delete
AFTER DELETE ON public.clients
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

-- Triggers for sessions
CREATE TRIGGER audit_log_sessions_insert
AFTER INSERT ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_log_sessions_update
AFTER UPDATE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_log_sessions_delete
AFTER DELETE ON public.sessions
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

-- Triggers for transcripts
CREATE TRIGGER audit_log_transcripts_insert
AFTER INSERT ON public.transcripts
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_log_transcripts_update
AFTER UPDATE ON public.transcripts
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_log_transcripts_delete
AFTER DELETE ON public.transcripts
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

-- Triggers for artifacts
CREATE TRIGGER audit_log_artifacts_insert
AFTER INSERT ON public.artifacts
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_log_artifacts_update
AFTER UPDATE ON public.artifacts
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();

CREATE TRIGGER audit_log_artifacts_delete
AFTER DELETE ON public.artifacts
FOR EACH ROW EXECUTE FUNCTION public.audit_log_trigger_fn();
