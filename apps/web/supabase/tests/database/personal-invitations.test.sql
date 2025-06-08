begin;
create extension "basejump-supabase_test_helpers" version '0.0.6';

select no_plan();

-- Setup test identities
select makerkit.set_identifier('account_owner', 'owner@example.com');
select makerkit.set_identifier('member', 'member@example.com');
select makerkit.set_identifier('non_member', 'nonmember@example.com');
select makerkit.set_identifier('personal_account', 'personal@example.com');

-- Initialize test data
select makerkit.authenticate_as('personal_account');

-- Create a personal account if not already created by the fixture
do $$
begin
    if not exists(select 1 from public.accounts where is_personal_account = true and created_by = (select auth.uid())) then
        insert into public.accounts (name, is_personal_account, created_by, updated_by)
        values ('Test Personal Account', true, auth.uid(), auth.uid());
    end if;
end
$$;

-- Get the personal account ID for current user
create or replace function get_current_personal_account_id()
returns uuid as $$
begin
    return (select id from public.accounts where is_personal_account = true and created_by = auth.uid());
end;
$$ language plpgsql security definer;

-- Test: Personal Account Owner Can Create Personal Invites
select lives_ok(
    $$ insert into public.personal_invites (email, invited_by_account_id, token, expires_at) 
       values ('invited1@example.com', get_current_personal_account_id(), gen_random_uuid(), (now() + interval '7 days')); $$,
    'personal account owner should be able to create personal invitations'
);

-- Test: Cannot create duplicate invitations for same email
select throws_ok(
    $$ insert into public.personal_invites (email, invited_by_account_id, token, expires_at) 
       values ('invited1@example.com', get_current_personal_account_id(), gen_random_uuid(), (now() + interval '7 days')); $$,
    'duplicate key value violates unique constraint "personal_invites_email_invited_by_account_id_key"'
);

-- Test: User can list their own personal invitations
select isnt_empty(
    $$ select * from public.personal_invites where invited_by_account_id = get_current_personal_account_id() $$,
    'personal account owner should see their invitations'
);

-- Test: Non-member cannot create invitations for someone else's account
select makerkit.authenticate_as('non_member');

select throws_ok(
    $$ insert into public.personal_invites (email, invited_by_account_id, token, expires_at) 
       values ('invited2@example.com', (select get_current_personal_account_id() from makerkit.authenticate_as('personal_account')), gen_random_uuid(), (now() + interval '7 days')); $$,
    'new row violates row-level security policy for table "personal_invites"'
);

-- Test: Non-member cannot see other's invitations
select is_empty(
    $$ select * from public.personal_invites $$,
    'non-member should not see any invitations'
);

-- Test anonymous.get_invite_by_token function
-- Let's go back to being the personal account owner 
select makerkit.authenticate_as('personal_account');

-- Generate a token for testing
do $$
declare
    test_token uuid := gen_random_uuid();
begin
    insert into public.personal_invites (
        email, 
        invited_by_account_id, 
        token, 
        expires_at,
        language
    ) values (
        'invited3@example.com', 
        get_current_personal_account_id(), 
        test_token, 
        (now() + interval '7 days'),
        'en'
    );
    
    -- Store token for future tests
    perform set_config('app.test_token', test_token::text, false);
end
$$;

-- Test: Anonymous user can access the function with valid token
select makerkit.authenticate_as(null); -- simulate anonymous user

select lives_ok(
    $$ select * from anonymous.get_invite_by_token(current_setting('app.test_token')); $$,
    'anonymous user should be able to use get_invite_by_token function'
);

select is(
    (select email from anonymous.get_invite_by_token(current_setting('app.test_token'))),
    'invited3@example.com',
    'get_invite_by_token returns correct email'
);

select is(
    (select valid from anonymous.get_invite_by_token(current_setting('app.test_token'))),
    true,
    'get_invite_by_token indicates valid token'
);

select is(
    (select language from anonymous.get_invite_by_token(current_setting('app.test_token'))),
    'en',
    'get_invite_by_token returns correct language setting'
);

-- Test with invalid token
select is_empty(
    $$ select * from anonymous.get_invite_by_token('00000000-0000-0000-0000-000000000000') $$,
    'get_invite_by_token returns no rows for invalid token'
);

-- Test: Authenticated users accessing the function
select makerkit.authenticate_as('personal_account');

select lives_ok(
    $$ select * from anonymous.get_invite_by_token(current_setting('app.test_token')); $$,
    'authenticated user should be able to use get_invite_by_token function'
);

-- Test: Update personal invite status by the invited person
-- First, let's create a new user and an invitation for them
select tests.create_supabase_user('invited_user');
select makerkit.authenticate_as('personal_account');

do $$
declare
    accept_token uuid := gen_random_uuid();
begin
    insert into public.personal_invites (
        email, 
        invited_by_account_id, 
        token, 
        expires_at
    ) values (
        'invited_user@example.com', 
        get_current_personal_account_id(), 
        accept_token, 
        (now() + interval '7 days')
    );
    
    -- Store token for acceptance test
    perform set_config('app.accept_token', accept_token::text, false);
end
$$;

-- Authenticate as the invited user and try to accept the invitation
select makerkit.authenticate_as('invited_user');

select lives_ok(
    $$ update public.personal_invites 
       set status = 'accepted', 
           accepted_at = now(),
           invited_account_id = auth.uid()
       where token = current_setting('app.accept_token')::uuid; $$,
    'invited user should be able to accept their invitation'
);

select is(
    (select status from public.personal_invites where token = current_setting('app.accept_token')::uuid),
    'accepted',
    'invitation status should be updated to accepted'
);

select isnt_null(
    (select invited_account_id from public.personal_invites where token = current_setting('app.accept_token')::uuid),
    'invited_account_id should be set'
);

-- Test: Random user cannot modify someone else's invitation status
select makerkit.authenticate_as('non_member');

select throws_ok(
    $$ update public.personal_invites 
       set status = 'revoked'
       where token = current_setting('app.test_token')::uuid; $$,
    'new row violates row-level security policy for table "personal_invites"',
    'non-member cannot modify other users invitations'
);

-- Test revocation by the inviter
select makerkit.authenticate_as('personal_account');

select lives_ok(
    $$ update public.personal_invites 
       set status = 'revoked' 
       where token = current_setting('app.test_token')::uuid; $$,
    'personal account owner should be able to revoke their invitations'
);

select is(
    (select status from public.personal_invites where token = current_setting('app.test_token')::uuid),
    'revoked',
    'invitation status should be updated to revoked'
);

-- Clean up
drop function if exists get_current_personal_account_id();

select * from finish();

rollback;
