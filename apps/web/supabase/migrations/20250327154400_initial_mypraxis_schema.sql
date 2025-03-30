/*
 * -------------------------------------------------------
 * MyPraxis Therapy Application Schema
 * This migration creates the schema for the therapy application.
 * It includes tables for therapists, clients, sessions, artifacts, and related entities.
 * -------------------------------------------------------
 */

-- Create enum for artifact reference types
CREATE TYPE public.artifact_reference_type AS ENUM ('client', 'session', 'therapist');

-- Create enum for artifact types
CREATE TYPE public.artifact_type AS ENUM ('session_client_summary', 'session_therapist_summary', 'client_prep_note', 'client_conceptualization', 'client_bio');

/*
 * -------------------------------------------------------
 * Section: Geo Localities
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.geo_localities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  name VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL
);

COMMENT ON TABLE public.geo_localities IS 'Geographic localities for therapists';
COMMENT ON COLUMN public.geo_localities.name IS 'Locality names used as i18n keys';

-- RLS for geo_localities
ALTER TABLE public.geo_localities ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read geo_localities
CREATE POLICY "Anyone can read geo_localities" 
  ON public.geo_localities FOR SELECT 
  TO authenticated 
  USING (true);

-- Only service_role can modify geo_localities
CREATE POLICY "Only service_role can modify geo_localities" 
  ON public.geo_localities FOR ALL 
  TO service_role 
  USING (true);

-- Indexes
CREATE INDEX ix_geo_localities_name ON public.geo_localities (name);

-- Populate geo_localities with initial data
INSERT INTO public.geo_localities (id, name, title) VALUES
('11111111-1111-4111-a111-111111111111', 'eu', 'European Union'),
('22222222-2222-4222-a222-222222222222', 'us', 'United States'),
('33333333-3333-4333-a333-333333333333', 'ca', 'Canada'),
('44444444-4444-4444-a444-444444444444', 'uk', 'United Kingdom'),
('55555555-5555-4555-a555-555555555555', 'nz', 'New Zealand'),
('66666666-6666-4666-a666-666666666666', 'au', 'Australia'),
('77777777-7777-4777-a777-777777777777', 'ru', 'Russian Federation'),
('88888888-8888-4888-a888-888888888888', 'other', 'Other');

/*
 * -------------------------------------------------------
 * Section: Therapeutic Approaches
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.therapeutic_approaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  name VARCHAR(64) NOT NULL,
  title VARCHAR(255) NOT NULL
);

COMMENT ON TABLE public.therapeutic_approaches IS 'Therapeutic approaches used by therapists';
COMMENT ON COLUMN public.therapeutic_approaches.name IS 'Approach names used as i18n keys';
COMMENT ON COLUMN public.therapeutic_approaches.title IS 'Full title of the therapeutic approach';

-- RLS for therapeutic_approaches
ALTER TABLE public.therapeutic_approaches ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read therapeutic_approaches
CREATE POLICY "Anyone can read therapeutic_approaches" 
  ON public.therapeutic_approaches FOR SELECT 
  TO authenticated 
  USING (true);

-- Only service_role can modify therapeutic_approaches
CREATE POLICY "Only service_role can modify therapeutic_approaches" 
  ON public.therapeutic_approaches FOR ALL 
  TO service_role 
  USING (true);

-- Indexes
CREATE INDEX ix_therapeutic_approaches_name ON public.therapeutic_approaches (name);

-- Populate therapeutic_approaches with initial data
INSERT INTO public.therapeutic_approaches (id, name, title) VALUES
('a1111111-1111-4111-a111-111111111111', 'act', 'Acceptance and Commitment Therapy (ACT)'),
('a2222222-2222-4222-a222-222222222222', 'cbt', 'Cognitive Behavioral Therapy (CBT)'),
('a3333333-3333-4333-a333-333333333333', 'dbt', 'Dialectical Behavior Therapy (DBT)'),
('a4444444-4444-4444-a444-444444444444', 'emdr', 'Eye Movement Desensitization and Reprocessing (EMDR)'),
('a5555555-5555-4555-a555-555555555555', 'eft', 'Emotionally Focused Therapy (EFT)'),
('a6666666-6666-4666-a666-666666666666', 'fst', 'Family Systems Therapy'),
('a7777777-7777-4777-a777-777777777777', 'gt', 'Gestalt Therapy'),
('a8888888-8888-4888-a888-888888888888', 'ifs', 'Internal Family Systems (IFS)'),
('a9999999-9999-4999-a999-999999999999', 'ipt', 'Interpersonal Therapy (IPT)'),
('b1111111-1111-4111-b111-111111111111', 'ja', 'Jungian Analysis'),
('b2222222-2222-4222-b222-222222222222', 'mbct', 'Mindfulness-Based Cognitive Therapy (MBCT)'),
('b3333333-3333-4333-b333-333333333333', 'mi', 'Motivational Interviewing'),
('b4444444-4444-4444-b444-444444444444', 'nt', 'Narrative Therapy'),
('b5555555-5555-4555-b555-555555555555', 'pct', 'Person-Centered (Rogerian) Therapy'),
('b6666666-6666-4666-b666-666666666666', 'pa', 'Psychoanalysis'),
('b7777777-7777-4777-b777-777777777777', 'pdt', 'Psychodynamic Therapy'),
('b8888888-8888-4888-b888-888888888888', 'sfbt', 'Solution-Focused Brief Therapy (SFBT)'),
('b9999999-9999-4999-b999-999999999999', 'other', 'Other')
;

/*
 * -------------------------------------------------------
 * Section: User Preferences
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.user_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  use_24hr_clock BOOLEAN DEFAULT TRUE NOT NULL,
  use_us_date_format BOOLEAN DEFAULT FALSE NOT NULL,
  language VARCHAR(10) DEFAULT 'en' NOT NULL
);

COMMENT ON TABLE public.user_preferences IS 'User preferences for the application';
COMMENT ON COLUMN public.user_preferences.account_id IS 'The account these preferences belong to';
COMMENT ON COLUMN public.user_preferences.use_24hr_clock IS 'Whether to use 24-hour clock format (true) or 12-hour clock format (false)';
COMMENT ON COLUMN public.user_preferences.use_us_date_format IS 'Whether to use US date format MM/DD/YYYY (true) or international format DD/MM/YYYY (false)';
COMMENT ON COLUMN public.user_preferences.language IS 'Preferred language';

-- RLS for user_preferences
ALTER TABLE public.user_preferences ENABLE ROW LEVEL SECURITY;

-- Users can only access their own preferences
CREATE POLICY "Users can access their own preferences"
  ON public.user_preferences FOR ALL
  USING (public.is_account_owner(account_id));

-- Indexes
CREATE INDEX ix_user_preferences_account_id ON public.user_preferences (account_id);

/*
 * -------------------------------------------------------
 * Section: Therapists
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.therapists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  credentials TEXT,
  geo_locality_id UUID REFERENCES public.geo_localities(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.therapists IS 'Therapists in the system';
COMMENT ON COLUMN public.therapists.account_id IS 'The account this therapist belongs to';
COMMENT ON COLUMN public.therapists.credentials IS 'Professional credentials of the therapist';
COMMENT ON COLUMN public.therapists.geo_locality_id IS 'Geographic locality of the therapist';

-- RLS for therapists
ALTER TABLE public.therapists ENABLE ROW LEVEL SECURITY;

-- Users can only access therapists in accounts they belong to
CREATE POLICY "Users can access therapists in their accounts"
  ON public.therapists FOR ALL
  USING (public.is_account_owner(account_id));

-- Indexes
CREATE INDEX ix_therapists_account_id ON public.therapists (account_id);
CREATE INDEX ix_therapists_geo_locality_id ON public.therapists (geo_locality_id);

/*
 * -------------------------------------------------------
 * Section: Therapists Approaches (Join Table)
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.therapists_approaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.therapists(id) ON DELETE CASCADE NOT NULL,
  approach_id UUID REFERENCES public.therapeutic_approaches(id) ON DELETE CASCADE NOT NULL,
  priority INTEGER NOT NULL DEFAULT 0,
  UNIQUE(therapist_id, approach_id),
  UNIQUE(therapist_id, priority)
);

COMMENT ON TABLE public.therapists_approaches IS 'Join table for therapists and their therapeutic approaches';
COMMENT ON COLUMN public.therapists_approaches.account_id IS 'The account this relationship belongs to';
COMMENT ON COLUMN public.therapists_approaches.therapist_id IS 'The therapist';
COMMENT ON COLUMN public.therapists_approaches.approach_id IS 'The therapeutic approach';
COMMENT ON COLUMN public.therapists_approaches.priority IS 'Display order/priority of the approach for the therapist';

-- Trigger to automatically set account_id from therapist
CREATE OR REPLACE FUNCTION public.set_therapist_approach_account_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.therapists WHERE id = NEW.therapist_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_therapist_approach_account_id_trigger
  BEFORE INSERT ON public.therapists_approaches
  FOR EACH ROW
  EXECUTE FUNCTION public.set_therapist_approach_account_id();

-- RLS for therapists_approaches
ALTER TABLE public.therapists_approaches ENABLE ROW LEVEL SECURITY;

-- Users can only access therapist approaches in accounts they belong to
CREATE POLICY "Users can access therapist approaches in their accounts"
  ON public.therapists_approaches FOR ALL
  USING (public.is_account_owner(account_id));

-- Indexes
CREATE INDEX ix_therapists_approaches_account_id ON public.therapists_approaches (account_id);
CREATE INDEX ix_therapists_approaches_therapist_id ON public.therapists_approaches (therapist_id);
CREATE INDEX ix_therapists_approaches_approach_id ON public.therapists_approaches (approach_id);
CREATE INDEX ix_therapists_approaches_therapist_priority ON public.therapists_approaches (therapist_id, priority);

/*
 * -------------------------------------------------------
 * Section: Clients
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  therapist_id UUID REFERENCES public.therapists(id) ON DELETE CASCADE NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT CHECK (email IS NULL OR email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'),
  phone TEXT CHECK (phone IS NULL OR phone ~* '^\+?[0-9\s\-\(\)]{8,20}$')
);

COMMENT ON TABLE public.clients IS 'Therapy clients';
COMMENT ON COLUMN public.clients.account_id IS 'The account this client belongs to';
COMMENT ON COLUMN public.clients.therapist_id IS 'The therapist responsible for this client';
COMMENT ON COLUMN public.clients.full_name IS 'Full name of the client';
COMMENT ON COLUMN public.clients.email IS 'Email address of the client';
COMMENT ON COLUMN public.clients.phone IS 'Phone number of the client';

-- RLS for clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- Users can only access clients in accounts they belong to
CREATE POLICY "Users can access clients in their accounts"
  ON public.clients FOR ALL
  USING (public.is_account_owner(account_id));

-- Trigger to automatically set account_id from therapist
CREATE OR REPLACE FUNCTION public.set_client_account_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.therapists WHERE id = NEW.therapist_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_client_account_id_trigger
  BEFORE INSERT ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.set_client_account_id();

-- Indexes
CREATE INDEX ix_clients_account_id ON public.clients (account_id);
CREATE INDEX ix_clients_therapist_id ON public.clients (therapist_id);
CREATE INDEX ix_clients_full_name ON public.clients (full_name);
CREATE INDEX ix_clients_email ON public.clients (email);

/*
 * -------------------------------------------------------
 * Section: Sessions
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE NOT NULL,
  transcript TEXT,
  note TEXT
);

COMMENT ON TABLE public.sessions IS 'Therapy sessions';
COMMENT ON COLUMN public.sessions.account_id IS 'The account this session belongs to';
COMMENT ON COLUMN public.sessions.client_id IS 'The client this session is for';
COMMENT ON COLUMN public.sessions.transcript IS 'Transcript of the session';
COMMENT ON COLUMN public.sessions.note IS 'Notes about the session';

-- RLS for sessions
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;

-- Users can only access sessions in accounts they belong to
CREATE POLICY "Users can access sessions in their accounts"
  ON public.sessions FOR ALL
  USING (public.is_account_owner(account_id));

-- Trigger to automatically set account_id from client
CREATE OR REPLACE FUNCTION public.set_session_account_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    SELECT account_id INTO NEW.account_id FROM public.clients WHERE id = NEW.client_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_session_account_id_trigger
  BEFORE INSERT ON public.sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.set_session_account_id();

-- Indexes
CREATE INDEX ix_sessions_account_id ON public.sessions (account_id);
CREATE INDEX ix_sessions_client_id ON public.sessions (client_id);

/*
 * -------------------------------------------------------
 * Section: Artifacts (Polymorphic)
 * -------------------------------------------------------
 */
CREATE TABLE IF NOT EXISTS public.artifacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
  account_id UUID REFERENCES public.accounts(id) ON DELETE CASCADE NOT NULL,
  reference_type public.artifact_reference_type NOT NULL,
  reference_id UUID NOT NULL,
  type public.artifact_type NOT NULL,
  CONSTRAINT valid_artifact_type_for_reference CHECK (
    (reference_type = 'session' AND type IN ('session_client_summary', 'session_therapist_summary')) OR
    (reference_type = 'client' AND type IN ('client_prep_note', 'client_conceptualization', 'client_bio')) OR
    (reference_type = 'therapist')
  ),
  content TEXT
);

COMMENT ON TABLE public.artifacts IS 'Polymorphic artifacts for various entities';
COMMENT ON COLUMN public.artifacts.account_id IS 'The account this artifact belongs to';
COMMENT ON COLUMN public.artifacts.reference_type IS 'The type of entity this artifact is for (client, session, therapist)';
COMMENT ON COLUMN public.artifacts.reference_id IS 'The ID of the entity this artifact is for';
COMMENT ON COLUMN public.artifacts.type IS 'The type of artifact';
COMMENT ON COLUMN public.artifacts.content IS 'The content of the artifact';

-- RLS for artifacts
ALTER TABLE public.artifacts ENABLE ROW LEVEL SECURITY;

-- Users can only access artifacts in accounts they belong to
CREATE POLICY "Users can access artifacts in their accounts"
  ON public.artifacts FOR ALL
  USING (public.is_account_owner(account_id));

-- Trigger to automatically set account_id from reference
CREATE OR REPLACE FUNCTION public.set_artifact_account_id()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.account_id IS NULL THEN
    CASE NEW.reference_type
      WHEN 'client' THEN
        SELECT account_id INTO NEW.account_id FROM public.clients WHERE id = NEW.reference_id;
      WHEN 'session' THEN
        SELECT account_id INTO NEW.account_id FROM public.sessions WHERE id = NEW.reference_id;
      WHEN 'therapist' THEN
        SELECT account_id INTO NEW.account_id FROM public.therapists WHERE id = NEW.reference_id;
      ELSE
        -- For other reference types, account_id must be provided
        RAISE EXCEPTION 'account_id must be provided for reference_type %', NEW.reference_type;
    END CASE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_artifact_account_id_trigger
  BEFORE INSERT ON public.artifacts
  FOR EACH ROW
  EXECUTE FUNCTION public.set_artifact_account_id();

-- Indexes
CREATE INDEX ix_artifacts_account_id ON public.artifacts (account_id);
CREATE INDEX ix_artifacts_reference ON public.artifacts (reference_type, reference_id);

/*
 * -------------------------------------------------------
 * Section: Automatic Timestamp Updates
 * -------------------------------------------------------
 */

-- Function to automatically update the updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for all tables with updated_at column
CREATE TRIGGER update_user_preferences_updated_at
    BEFORE UPDATE ON public.user_preferences
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_therapists_updated_at
    BEFORE UPDATE ON public.therapists
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_therapists_approaches_updated_at
    BEFORE UPDATE ON public.therapists_approaches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clients_updated_at
    BEFORE UPDATE ON public.clients
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sessions_updated_at
    BEFORE UPDATE ON public.sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_artifacts_updated_at
    BEFORE UPDATE ON public.artifacts
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_geo_localities_updated_at
    BEFORE UPDATE ON public.geo_localities
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_therapeutic_approaches_updated_at
    BEFORE UPDATE ON public.therapeutic_approaches
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

/*
 * -------------------------------------------------------
 * Section: Triggers for Validation
 * -------------------------------------------------------
 */

-- Trigger function to validate artifact references
CREATE OR REPLACE FUNCTION public.validate_artifact_reference()
RETURNS TRIGGER AS $$
BEGIN
  -- Check that the reference exists in the appropriate table
  IF NEW.reference_type = 'client' THEN
    IF NOT EXISTS (SELECT 1 FROM public.clients WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Referenced client does not exist';
    END IF;
  ELSIF NEW.reference_type = 'session' THEN
    IF NOT EXISTS (SELECT 1 FROM public.sessions WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Referenced session does not exist';
    END IF;
  ELSIF NEW.reference_type = 'therapist' THEN
    IF NOT EXISTS (SELECT 1 FROM public.therapists WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Referenced therapist does not exist';
    END IF;
  END IF;
  
  -- Ensure account_id consistency
  IF NEW.reference_type = 'client' THEN
    IF NEW.account_id != (SELECT account_id FROM public.clients WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Artifact account_id must match referenced client account_id';
    END IF;
  ELSIF NEW.reference_type = 'session' THEN
    IF NEW.account_id != (SELECT account_id FROM public.sessions WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Artifact account_id must match referenced session account_id';
    END IF;
  ELSIF NEW.reference_type = 'therapist' THEN
    IF NEW.account_id != (SELECT account_id FROM public.therapists WHERE id = NEW.reference_id) THEN
      RAISE EXCEPTION 'Artifact account_id must match referenced therapist account_id';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for artifacts
CREATE TRIGGER validate_artifact_reference_trigger
BEFORE INSERT OR UPDATE ON public.artifacts
FOR EACH ROW EXECUTE FUNCTION public.validate_artifact_reference();

-- Trigger function to ensure account_id consistency for therapist approaches
CREATE OR REPLACE FUNCTION public.ensure_therapist_approach_account_id()
RETURNS TRIGGER AS $$
BEGIN
  -- Set account_id to match the therapist's account_id
  NEW.account_id := (SELECT account_id FROM public.therapists WHERE id = NEW.therapist_id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for therapists_approaches
CREATE TRIGGER ensure_therapist_approach_account_id_trigger
BEFORE INSERT OR UPDATE ON public.therapists_approaches
FOR EACH ROW EXECUTE FUNCTION public.ensure_therapist_approach_account_id();

/*
 * -------------------------------------------------------
 * Section: Revocations and Grants
 * -------------------------------------------------------
 */

-- Revoke all privileges from public, authenticated, and service_role (we'll grant specific ones below)
REVOKE ALL ON public.user_preferences FROM public, authenticated, service_role;
REVOKE ALL ON public.therapists FROM public, authenticated, service_role;
REVOKE ALL ON public.therapists_approaches FROM public, authenticated, service_role;
REVOKE ALL ON public.clients FROM public, authenticated, service_role;
REVOKE ALL ON public.sessions FROM public, authenticated, service_role;
REVOKE ALL ON public.artifacts FROM public, authenticated, service_role;
REVOKE ALL ON public.geo_localities FROM public, authenticated, service_role;
REVOKE ALL ON public.therapeutic_approaches FROM public, authenticated, service_role;

-- Grant appropriate privileges to authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_preferences TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapists TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.therapists_approaches TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.artifacts TO authenticated;
GRANT SELECT ON public.geo_localities TO authenticated;
GRANT SELECT ON public.therapeutic_approaches TO authenticated;

-- Grant usage on the artifact_reference_type and artifact_type enums
GRANT USAGE ON TYPE public.artifact_reference_type TO authenticated;
GRANT USAGE ON TYPE public.artifact_type TO authenticated;

-- Grant all privileges to service_role
GRANT ALL PRIVILEGES ON public.user_preferences TO service_role;
GRANT ALL PRIVILEGES ON public.therapists TO service_role;
GRANT ALL PRIVILEGES ON public.therapists_approaches TO service_role;
GRANT ALL PRIVILEGES ON public.clients TO service_role;
GRANT ALL PRIVILEGES ON public.sessions TO service_role;
GRANT ALL PRIVILEGES ON public.artifacts TO service_role;
GRANT ALL PRIVILEGES ON public.geo_localities TO service_role;
GRANT ALL PRIVILEGES ON public.therapeutic_approaches TO service_role;
