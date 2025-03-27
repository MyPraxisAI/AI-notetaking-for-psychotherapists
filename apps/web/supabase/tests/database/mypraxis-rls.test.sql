BEGIN;
create extension "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

-- Create test users with personal accounts (Makerkit automatically creates them)
select tests.create_supabase_user('account_owner', 'owner@mypraxis.ai');
select tests.create_supabase_user('other_owner', 'other@mypraxis.ai');
select tests.create_supabase_user('unauthorized', 'unauthorized@example.com');

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

-- Should be able to insert own data
select lives_ok(
  $$ INSERT INTO public.therapists (id, account_id, credentials, geo_locality_id)
     VALUES ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 
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

select * from finish();

ROLLBACK;
