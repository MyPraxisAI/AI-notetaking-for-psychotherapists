-- mypraxis-audit-log.test.sql
-- Tests for audit_log triggers on clients, sessions, transcripts, and artifacts
-- Assumes existence of test user and account UUIDs

BEGIN;
create extension if not exists "basejump-supabase_test_helpers";

select no_plan();

-- Create test user with personal account (matching RLS test)
select tests.create_supabase_user('account_owner', 'owner@mypraxis.ai');
select makerkit.authenticate_as('account_owner');

-- Debug: verify account and ownership
select id, primary_owner_user_id from public.accounts where primary_owner_user_id = tests.get_supabase_uid('account_owner');

-- Use deterministic UUIDs for test records
-- therapist: 22222222-2222-4222-4222-222222222222
-- client:    33333333-3333-3333-3333-333333333333
-- session:   44444444-4444-4444-4444-444444444444
-- transcript:55555555-5555-5555-5555-555555555555
-- artifact:  66666666-6666-6666-6666-666666666666

-- Clean up any existing data for the test account to avoid conflicts
DO $$
DECLARE
  test_account_id uuid;
BEGIN
  SELECT id INTO test_account_id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner');
  
  -- Clean up in reverse dependency order
  DELETE FROM public.artifacts WHERE account_id = test_account_id;
  DELETE FROM public.transcripts WHERE account_id = test_account_id;
  DELETE FROM public.sessions WHERE account_id = test_account_id;
  DELETE FROM public.clients WHERE account_id = test_account_id;
  DELETE FROM public.therapists WHERE account_id = test_account_id;
END $$;

-- Insert all required base records ONCE for all tests
select makerkit.authenticate_as('account_owner');
select lives_ok(
  $$ INSERT INTO public.therapists (id, account_id, credentials, geo_locality_id) VALUES ('22222222-2222-4222-4222-222222222222', (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')), 'Test Credentials', '22222222-2222-4222-a222-222222222222') $$,
  'Insert therapist for test account (setup)'
);

-- RLS: Only service_role can read from audit_log
select makerkit.authenticate_as('account_owner');
select throws_ok(
  $$ SELECT * FROM public.audit_log $$,
  '42501',
  'permission denied for table audit_log',
  'Authenticated user should not be able to read from audit_log'
);
set local role service_role;
select lives_ok(
  $$ SELECT * FROM public.audit_log $$,
  'Service role should be able to read from audit_log'
);
select makerkit.authenticate_as('account_owner');

-- Test: service_role can insert into audit_log for auth.users
set local role service_role;
select lives_ok(
  $$ INSERT INTO public.audit_log (id, action_type, table_name, record_id, acting_user_id, account_id, application, timestamp)
     VALUES (gen_random_uuid(), 'CREATE', 'auth.users', gen_random_uuid(), gen_random_uuid(), gen_random_uuid(), 'test-app', now()) $$,
  'Service role can insert into audit_log for auth.users'
);
-- Insert for sessions (service_role currently bypasses RLS in Supabase, no way to prevent it)
select lives_ok(
  $$ INSERT INTO public.audit_log (id, action_type, table_name, record_id, acting_user_id, account_id, application, timestamp)
     VALUES ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'CREATE', 'sessions', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', gen_random_uuid(), gen_random_uuid(), 'test-app', now()) $$,
  'Service role can insert into audit_log (bypasses RLS)'
);
-- Verify the row was actually inserted
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  'audit_log row was inserted by service_role'
);

-- Test immutability: audit_log records cannot be modified or deleted
set local role service_role;
select throws_ok(
  $$ UPDATE public.audit_log SET application = 'modified-app' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  '42501',
  'permission denied for table audit_log',
  'service_role cannot UPDATE audit_log records (no UPDATE permission)'
);

select throws_ok(
  $$ DELETE FROM public.audit_log WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  '42501',
  'permission denied for table audit_log',
  'service_role cannot DELETE audit_log records (no DELETE permission)'
);

-- Verify the record still exists and unchanged
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' AND application = 'test-app' $$,
  'audit_log record remains unchanged after failed modification attempts'
);

-- Test immutability for authenticated users 
select makerkit.authenticate_as('account_owner');
select throws_ok(
  $$ UPDATE public.audit_log SET application = 'hacked-app' WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  '42501',
  'permission denied for table audit_log',
  'Authenticated users cannot UPDATE audit_log records (no permissions)'
);

select throws_ok(
  $$ DELETE FROM public.audit_log WHERE id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa' $$,
  '42501',
  'permission denied for table audit_log',
  'Authenticated users cannot DELETE audit_log records (no permissions)'
);

-- 1. Test audit_log for CLIENTS
select makerkit.authenticate_as('account_owner');
-- Insert
select lives_ok(
  $$ INSERT INTO public.clients (id, therapist_id, full_name, email, phone) VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-4222-4222-222222222222', 'Test Client', 'testclient@example.com', '+1-555-000-0000') $$,
  'Should be able to insert client and trigger audit_log CREATE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'clients' AND record_id = '33333333-3333-3333-3333-333333333333' AND action_type = 'CREATE' AND application = 'database-triggers' $$,
  'Audit log entry for client CREATE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');
-- Update
select lives_ok(
  $$ UPDATE public.clients SET full_name = 'Test Client Updated' WHERE id = '33333333-3333-3333-3333-333333333333' $$,
  'Should be able to update client and trigger audit_log UPDATE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'clients' AND record_id = '33333333-3333-3333-3333-333333333333' AND action_type = 'UPDATE' AND application = 'database-triggers' $$,
  'Audit log entry for client UPDATE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');
-- Delete
select lives_ok(
  $$ DELETE FROM public.clients WHERE id = '33333333-3333-3333-3333-333333333333' $$,
  'Should be able to delete client and trigger audit_log DELETE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'clients' AND record_id = '33333333-3333-3333-3333-333333333333' AND action_type = 'DELETE' AND application = 'database-triggers' $$,
  'Audit log entry for client DELETE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');

-- 2. Test audit_log for SESSIONS
select makerkit.authenticate_as('account_owner');
-- Re-insert client for session test (since it was deleted in previous test)
select lives_ok(
  $$ INSERT INTO public.clients (id, therapist_id, full_name, email, phone) VALUES ('33333333-3333-3333-3333-333333333333', '22222222-2222-4222-4222-222222222222', 'Test Client', 'testclient@example.com', '+1-555-000-0000') ON CONFLICT (id) DO NOTHING $$,
  'Re-insert client for session test'
);
-- Insert
select lives_ok(
  $$ INSERT INTO public.sessions (id, client_id, note) VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Test Session Note') $$,
  'Should be able to insert session and trigger audit_log CREATE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'sessions' AND record_id = '44444444-4444-4444-4444-444444444444' AND action_type = 'CREATE' AND application = 'database-triggers' $$,
  'Audit log entry for session CREATE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');
-- Update
select lives_ok(
  $$ UPDATE public.sessions SET note = 'Updated Session Note' WHERE id = '44444444-4444-4444-4444-444444444444' $$,
  'Should be able to update session and trigger audit_log UPDATE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'sessions' AND record_id = '44444444-4444-4444-4444-444444444444' AND action_type = 'UPDATE' AND application = 'database-triggers' $$,
  'Audit log entry for session UPDATE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');
-- Delete
select lives_ok(
  $$ DELETE FROM public.sessions WHERE id = '44444444-4444-4444-4444-444444444444' $$,
  'Should be able to delete session and trigger audit_log DELETE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'sessions' AND record_id = '44444444-4444-4444-4444-444444444444' AND action_type = 'DELETE' AND application = 'database-triggers' $$,
  'Audit log entry for session DELETE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');

-- 3. Test audit_log for TRANSCRIPTS
select makerkit.authenticate_as('account_owner');
-- Re-insert session for transcript test (since it was deleted in previous test)
select lives_ok(
  $$ INSERT INTO public.sessions (id, client_id, note) VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Test Session Note') ON CONFLICT (id) DO NOTHING $$,
  'Re-insert session for transcript test'
);
-- Insert
select lives_ok(
  $$ INSERT INTO public.transcripts (id, session_id, account_id, transcription_model, content) VALUES ('55555555-5555-5555-5555-555555555555', '44444444-4444-4444-4444-444444444444', (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')), 'test-model', 'Test transcript content') $$,
  'Should be able to insert transcript and trigger audit_log CREATE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'transcripts' AND record_id = '55555555-5555-5555-5555-555555555555' AND action_type = 'CREATE' AND application = 'database-triggers' $$,
  'Audit log entry for transcript CREATE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');
-- Update
select lives_ok(
  $$ UPDATE public.transcripts SET content = 'Updated transcript content' WHERE id = '55555555-5555-5555-5555-555555555555' $$,
  'Should be able to update transcript and trigger audit_log UPDATE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'transcripts' AND record_id = '55555555-5555-5555-5555-555555555555' AND action_type = 'UPDATE' AND application = 'database-triggers' $$,
  'Audit log entry for transcript UPDATE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');
-- Delete
select lives_ok(
  $$ DELETE FROM public.transcripts WHERE id = '55555555-5555-5555-5555-555555555555' $$,
  'Should be able to delete transcript and trigger audit_log DELETE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'transcripts' AND record_id = '55555555-5555-5555-5555-555555555555' AND action_type = 'DELETE' AND application = 'database-triggers' $$,
  'Audit log entry for transcript DELETE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');

-- 4. Test audit_log for ARTIFACTS
select makerkit.authenticate_as('account_owner');
-- Re-insert session for artifact test (since it was deleted when transcript was deleted)
select lives_ok(
  $$ INSERT INTO public.sessions (id, client_id, note) VALUES ('44444444-4444-4444-4444-444444444444', '33333333-3333-3333-3333-333333333333', 'Test Session Note') ON CONFLICT (id) DO NOTHING $$,
  'Re-insert session for artifact test'
);
-- Insert
select lives_ok(
  $$ INSERT INTO public.artifacts (id, reference_type, reference_id, type, content) VALUES ('66666666-6666-6666-6666-666666666666', 'session', '44444444-4444-4444-4444-444444444444', 'session_client_summary', 'Test artifact content') $$,
  'Should be able to insert artifact and trigger audit_log CREATE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'artifacts' AND record_id = '66666666-6666-6666-6666-666666666666' AND action_type = 'CREATE' AND application = 'database-triggers' $$,
  'Audit log entry for artifact CREATE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');
-- Update
select lives_ok(
  $$ UPDATE public.artifacts SET content = 'Updated artifact content' WHERE id = '66666666-6666-6666-6666-666666666666' $$,
  'Should be able to update artifact and trigger audit_log UPDATE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'artifacts' AND record_id = '66666666-6666-6666-6666-666666666666' AND action_type = 'UPDATE' AND application = 'database-triggers' $$,
  'Audit log entry for artifact UPDATE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');
-- Delete
select lives_ok(
  $$ DELETE FROM public.artifacts WHERE id = '66666666-6666-6666-6666-666666666666' $$,
  'Should be able to delete artifact and trigger audit_log DELETE'
);
set local role service_role;
select isnt_empty(
  $$ SELECT 1 FROM public.audit_log WHERE table_name = 'artifacts' AND record_id = '66666666-6666-6666-6666-666666666666' AND action_type = 'DELETE' AND application = 'database-triggers' $$,
  'Audit log entry for artifact DELETE exists and application is correct'
);
select makerkit.authenticate_as('account_owner');

select * from finish();
ROLLBACK; 

