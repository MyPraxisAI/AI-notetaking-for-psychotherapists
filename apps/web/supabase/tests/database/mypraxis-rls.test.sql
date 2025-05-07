BEGIN;
create extension "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

-- Create test users with personal accounts (Makerkit automatically creates them)
select tests.create_supabase_user('account_owner', 'owner@mypraxis.ai');
select tests.create_supabase_user('other_owner', 'other@mypraxis.ai');
select tests.create_supabase_user('unauthorized', 'unauthorized@example.com');

-- Clean up any existing data for these test users to avoid unique constraint violations
-- Get account IDs for all test users
DO $$
DECLARE
  test_account_ids uuid[];
BEGIN
  SELECT ARRAY_AGG(id) INTO test_account_ids FROM public.accounts WHERE primary_owner_user_id IN (
    tests.get_supabase_uid('account_owner'),
    tests.get_supabase_uid('other_owner'),
    tests.get_supabase_uid('unauthorized')
  );
  
  -- Delete records from tables with unique constraints on account_id
  DELETE FROM public.therapists WHERE account_id = ANY(test_account_ids);
  DELETE FROM public.user_preferences WHERE account_id = ANY(test_account_ids);
END $$;

-- Test anon access to all tables
set local role anon;

-- Anon should not be able to access any tables except public reference data
SELECT throws_ok(
  $$ SELECT * FROM public.therapists $$,
  '42501',
  'permission denied for schema public',
  'Anon should not be able to access therapists table'
);

SELECT throws_ok(
  $$ SELECT * FROM public.clients $$,
  '42501',
  'permission denied for schema public',
  'Anon should not be able to access clients table'
);

SELECT throws_ok(
  $$ SELECT * FROM public.sessions $$,
  '42501',
  'permission denied for schema public',
  'Anon should not be able to access sessions table'
);

SELECT throws_ok(
  $$ SELECT * FROM public.artifacts $$,
  '42501',
  'permission denied for schema public',
  'Anon should not be able to access artifacts table'
);

SELECT throws_ok(
  $$ SELECT * FROM public.therapists_approaches $$,
  '42501',
  'permission denied for schema public',
  'Anon should not be able to access therapists_approaches table'
);

SELECT throws_ok(
  $$ SELECT * FROM public.user_preferences $$,
  '42501',
  'permission denied for schema public',
  'Anon should not be able to access user_preferences table'
);

-- Test reference data tables for anon
SELECT throws_ok(
  $$ SELECT * FROM public.geo_localities $$,
  '42501',
  'permission denied for schema public',
  'Anon should not be able to access geo_localities table'
);

SELECT throws_ok(
  $$ SELECT * FROM public.therapeutic_approaches $$,
  '42501',
  'permission denied for schema public',
  'Anon should not be able to access therapeutic_approaches table'
);

-- Test RLS policies for therapists table

-- First, authenticate as account_owner and insert data
select makerkit.authenticate_as('account_owner');

-- Insert a therapist record for account_owner
INSERT INTO public.therapists (id, account_id, credentials, geo_locality_id)
VALUES 
  ('33333333-3333-3333-3333-333333333333', 
   (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')), 
   'Test Credentials', 
   '22222222-2222-4222-a222-222222222222');

-- Now authenticate as other_owner and insert data
select makerkit.authenticate_as('other_owner');

-- Insert a therapist record for other_owner
INSERT INTO public.therapists (id, account_id, credentials, geo_locality_id)
VALUES 
  ('99999999-9999-9999-9999-999999999999', 
   (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('other_owner')), 
   'Other Credentials', 
   '22222222-2222-4222-a222-222222222222');

-- Test RLS policies as account_owner
select makerkit.authenticate_as('account_owner');

-- Should be able to see own data but not other account's data
SELECT isnt_empty(
  $$ SELECT * FROM public.therapists WHERE id = '33333333-3333-3333-3333-333333333333' $$,
  'Account owner should see their own therapists'
);

SELECT is_empty(
  $$ SELECT * FROM public.therapists WHERE id = '99999999-9999-9999-9999-999999999999' $$,
  'Account owner should not see other account therapists'
);

-- Test RLS policies as other_owner
select makerkit.authenticate_as('other_owner');

-- Should be able to see own data but not account_owner's data
SELECT isnt_empty(
  $$ SELECT * FROM public.therapists WHERE id = '99999999-9999-9999-9999-999999999999' $$,
  'Other owner should see their own therapists'
);

SELECT is_empty(
  $$ SELECT * FROM public.therapists WHERE id = '33333333-3333-3333-3333-333333333333' $$,
  'Other owner should not see account_owner therapists'
);

-- Test RLS policies as unauthorized user
select makerkit.authenticate_as('unauthorized');

-- Should not be able to see any data
SELECT is_empty(
  $$ SELECT * FROM public.therapists $$,
  'Unauthorized user should not see any therapists'
);

-- Test insert permissions
select makerkit.authenticate_as('account_owner');

-- Delete existing record first to avoid unique constraint violation
select lives_ok(
  $$ DELETE FROM public.therapists WHERE account_id = (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')) $$,
  'Account owner should be able to delete their own therapist'
);

-- Should be able to insert own data
select lives_ok(
  $$ INSERT INTO public.therapists (id, account_id, credentials, geo_locality_id)
     VALUES ('33333333-3333-3333-3333-333333333333', 
            (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')), 
            'New Credentials', 
            '22222222-2222-4222-a222-222222222222') $$,
  'Account owner should be able to insert their own therapist'
);

-- Should not be able to insert data for other account
select throws_ok(
  $$ INSERT INTO public.therapists (id, account_id, credentials, geo_locality_id)
     VALUES ('cccccccc-cccc-cccc-cccc-cccccccccccc', 
            (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('other_owner')), 
            'Unauthorized Credentials', 
            '22222222-2222-4222-a222-222222222222') $$,
  '42501',
  'new row violates row-level security policy for table "therapists"',
  'Account owner should not be able to insert therapist for other account'
);

-- Test update permissions
select lives_ok(
  $$ UPDATE public.therapists SET credentials = 'Updated Credentials' 
     WHERE id = '33333333-3333-3333-3333-333333333333' $$,
  'Account owner should be able to update their own therapist'
);

select is_empty(
  $$ UPDATE public.therapists SET credentials = 'Hacked Credentials' 
     WHERE id = '99999999-9999-9999-9999-999999999999' RETURNING id $$,
  'Account owner should not be able to update other account therapist'
);

-- Test inherited account_id via triggers
select makerkit.authenticate_as('account_owner');

-- Should be able to insert client without specifying account_id
select lives_ok(
  $$ INSERT INTO public.clients (id, therapist_id, full_name, email, phone)
     VALUES ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', '33333333-3333-3333-3333-333333333333', 'New Client', 'new@example.com', '+1-555-111-2222') $$,
  'Account owner should be able to insert client without specifying account_id'
);

-- Verify account_id was set correctly by trigger
select isnt_empty(
  $$ SELECT * FROM public.clients WHERE id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' AND account_id = (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')) $$,
  'Client account_id should be set automatically by trigger'
);

-- Test sessions table
select makerkit.authenticate_as('account_owner');

-- Insert a session record
select lives_ok(
  $$ INSERT INTO public.sessions (id, client_id, note)
     VALUES ('55555555-5555-5555-5555-555555555555', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Test note') $$,
  'Account owner should be able to insert session for their client'
);

-- Verify account_id was set correctly by trigger
select isnt_empty(
  $$ SELECT * FROM public.sessions WHERE id = '55555555-5555-5555-5555-555555555555' AND account_id = (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')) $$,
  'Session account_id should be set automatically by trigger'
);

-- Test transcripts table
select lives_ok(
  $$ INSERT INTO public.transcripts (id, session_id, account_id, transcription_model, content)
     VALUES ('44444444-4444-4444-4444-444444444444', 
             '55555555-5555-5555-5555-555555555555', 
             (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')),
             'whisper-1',
             'Test transcript content') $$,
  'Account owner should be able to insert transcript for their session'
);

-- Verify the transcript was inserted correctly
select isnt_empty(
  $$ SELECT * FROM public.transcripts WHERE id = '44444444-4444-4444-4444-444444444444' $$,
  'Transcript should be inserted correctly'
);

-- Test artifacts table
select makerkit.authenticate_as('account_owner');

-- Insert an artifact record
select lives_ok(
  $$ INSERT INTO public.artifacts (id, reference_type, reference_id, type, content)
     VALUES ('66666666-6666-6666-6666-666666666666', 'client', 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'client_bio', 'Test bio') $$,
  'Account owner should be able to insert artifact for their client'
);

-- Verify account_id was set correctly by trigger
select isnt_empty(
  $$ SELECT * FROM public.artifacts WHERE id = '66666666-6666-6666-6666-666666666666' AND account_id = (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')) $$,
  'Artifact account_id should be set automatically by trigger'
);

-- Test therapists_approaches table
select makerkit.authenticate_as('account_owner');

-- Insert a therapist_approach record
select lives_ok(
  $$ INSERT INTO public.therapists_approaches (id, therapist_id, approach_id, priority)
     VALUES ('77777777-7777-7777-7777-777777777777', '33333333-3333-3333-3333-333333333333', 'a2222222-2222-4222-a222-222222222222', 0) $$,
  'Account owner should be able to insert therapist_approach for their therapist'
);

-- Verify the record was inserted correctly
select isnt_empty(
  $$ SELECT * FROM public.therapists_approaches WHERE id = '77777777-7777-7777-7777-777777777777' $$,
  'Therapist approach should be inserted correctly'
);

-- Test user_preferences table
select makerkit.authenticate_as('account_owner');

-- Insert a user_preferences record
select lives_ok(
  $$ INSERT INTO public.user_preferences (id, account_id, use_24hr_clock, use_us_date_format, language)
     VALUES ('88888888-8888-8888-8888-888888888888', 
             (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')),
             true, false, 'en') $$,
  'Account owner should be able to insert user_preferences for their account'
);

-- Verify the record was inserted correctly
select isnt_empty(
  $$ SELECT * FROM public.user_preferences WHERE id = '88888888-8888-8888-8888-888888888888' $$,
  'User preferences should be inserted correctly'
);

-- Test cross-account visibility for all tables
select makerkit.authenticate_as('other_owner');

-- Should not be able to see account_owner's data in any table
SELECT is_empty(
  $$ SELECT * FROM public.clients WHERE therapist_id = '33333333-3333-3333-3333-333333333333' $$,
  'Other owner should not see account_owner clients'
);

SELECT is_empty(
  $$ SELECT * FROM public.sessions WHERE client_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' $$,
  'Other owner should not see account_owner sessions'
);

SELECT is_empty(
  $$ SELECT * FROM public.artifacts WHERE reference_id = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee' $$,
  'Other owner should not see account_owner artifacts'
);

SELECT is_empty(
  $$ SELECT * FROM public.transcripts WHERE session_id = '55555555-5555-5555-5555-555555555555' $$,
  'Other owner should not see account_owner transcripts'
);

SELECT is_empty(
  $$ SELECT * FROM public.therapists_approaches WHERE therapist_id = '33333333-3333-3333-3333-333333333333' $$,
  'Other owner should not see account_owner therapist_approaches'
);

SELECT is_empty(
  $$ SELECT * FROM public.user_preferences WHERE account_id = (SELECT id FROM public.accounts WHERE primary_owner_user_id = tests.get_supabase_uid('account_owner')) $$,
  'Other owner should not see account_owner user_preferences'
);

-- Test reference data tables for authenticated users
select makerkit.authenticate_as('account_owner');

-- Should be able to read reference data
SELECT isnt_empty(
  $$ SELECT * FROM public.therapeutic_approaches $$,
  'Authenticated user should be able to read therapeutic_approaches'
);

SELECT isnt_empty(
  $$ SELECT * FROM public.geo_localities $$,
  'Authenticated user should be able to read geo_localities'
);

-- Should not be able to insert into reference data tables
select throws_ok(
  $$ INSERT INTO public.therapeutic_approaches (id, name, title) 
     VALUES ('a9999999-9999-4999-a999-999999999999', 'test', 'Test Approach') $$,
  '42501',
  'permission denied for table therapeutic_approaches',
  'Authenticated user should not be able to insert into therapeutic_approaches'
);

select throws_ok(
  $$ INSERT INTO public.geo_localities (id, name) 
     VALUES ('a9999999-9999-4999-a999-999999999999', 'test_locality') $$,
  '42501',
  'permission denied for table geo_localities',
  'Authenticated user should not be able to insert into geo_localities'
);

-- Test service_role permissions for reference data tables
set local role service_role;

-- Should be able to insert into reference data tables
select lives_ok(
  $$ INSERT INTO public.therapeutic_approaches (id, name, title) 
     VALUES ('a0000000-0000-4000-a000-000000000000', 'test_approach', 'Test Approach') $$,
  'Service role should be able to insert into therapeutic_approaches'
);

select lives_ok(
  $$ INSERT INTO public.geo_localities (id, name, title) 
     VALUES ('a0000000-0000-4000-a000-000000000001', 'test_locality', 'Test Locality') $$,
  'Service role should be able to insert into geo_localities'
);

-- Clean up test data
DELETE FROM public.therapeutic_approaches WHERE id = 'a0000000-0000-4000-a000-000000000000';
DELETE FROM public.geo_localities WHERE id = 'a0000000-0000-4000-a000-000000000001';

select * from finish();

ROLLBACK;
