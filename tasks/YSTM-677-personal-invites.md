# Personal Invitations Implementation Plan

TODO:
[ ] from: email
[ ] post registration update - still doesn't work
[ ] Max  (after deploy!): Create the personal_invites webhook in supabase (similar to invites).
[ ] To fix: mypraxis-webapp/apps/web/lib/server/personal-invitations/webhooks/personal-invite-webhook.service.ts - this is not using personal-invite-email-service!
[ ] Check if all translations are in place
[x] Implement token separation in auth components (teamInviteToken vs personalInviteToken)
[x] Implement personal invitation processing after authentication
[x] Create `/complete-personal-invite` endpoint and server action

## Testing
[ ] Test personal invitation flow with OAuth providers
[ ] Test personal invitation flow with Magic Link
[ ] Test personal invitation flow with Password signup
[ ] Verify correct invitation status updates in database

## 1. Database Schema Design

- [x] **Create `personal_invites` table in Supabase:**
  - Fields: `id`, `email`, `role`, `created_at`, `expires_at`, `token` (securely generated), `invited_by`, `accepted_at`, `invited_account_id`, `status` (enum: pending, accepted, expired, revoked)
  - Enable Row Level Security (RLS)
  - Set up appropriate constraints (unique email per token, etc.)

- [x] **RLS Policies for `personal_invites` table:**
  - Admin/SuperAdmin can CREATE, READ all invites
  - Regular users can only read their own invites
  - Appropriate service role access for background workers

- [x] **Create SQL migration script:**
  - Table creation
  - RLS policy setup
  - Appropriate indexes for performance
  - Trigger for expiration management

- [x] **Update database types:**
  - Run `supabase:typegen` to generate TypeScript types

## 2. Backend Implementation

- [x] **Create server actions for invitation management:**
  - Created files in `/apps/web/lib/server/personal-invitations/`:
    - `schemas.ts` with Zod validation schemas
    - `server-actions.ts` with core functionality:
      - `createPersonalInviteAction`
      - `revokePersonalInviteAction`
      - `listPersonalInvitesAction` 
      - `verifyPersonalInviteAction`
  - Added proper error handling and structured logging

- [x] **Create email notification system:**
  - Created personal invitation email template in `packages/email-templates/src/emails/personal-invite.email.tsx`
  - Implemented email service in `apps/web/lib/server/personal-invitations/personal-invite-email.service.ts`
  - Integrated with existing mailer infrastructure via `@kit/mailers`
  - Added email sending to invitation creation process with error handling

- [ ] **Modify authentication flow:**
  - Update sign-up logic to check for valid invitations
  - Create invitation acceptance handler
  - Handle automatic account linking

## 3. Admin Interface

- [x] **Create admin UI components:**
  - Created `/packages/features/admin/src/components/admin-personal-invites-table.tsx`
  - Created `/packages/features/admin/src/components/create-personal-invitation-form.tsx`
  - Added revoke functionality directly in the table actions dropdown

- [x] **Create admin page:**
  - Created `/apps/web/app/admin/personal-invites/page.tsx` and `loading.tsx`
  - Added data loader in `/packages/features/admin/src/lib/server/loaders/admin-personal-invites-loader.ts`
  - Implemented filtering by status and search functionality
  - Integrated server actions with React Query for mutations

## 4. Feature Flag Implementation

- [x] **Add feature flag to config:**
  - Update `/apps/web/config/feature-flags.config.ts` with `enableInvitationOnlySignup`
  - Document the flag in appropriate locations

- [x] **Modify sign-up flow:**
  - Updated `/apps/web/app/auth/sign-up/page.tsx` to check feature flag and enforce invitation-only mode
  - Hidden sign-up link on login page when invitation-only mode is enabled
  - Added support for both team and personal invitation tokens
  - Created token validation server action for personal invitations

## 5. Sign-Up Flow Modification

- [x] **Enhance sign-up page for invitations:**
  - Updated sign-up components to handle both team and personal invitation tokens
  - Implemented token validation for personal invitations via `isPersonalInviteTokenValidAction`
  - Added appropriate error messages for invalid tokens

- [x] **Implement invitation-only mode:**
  - Updated sign-up form to require a valid invitation token when feature flag is enabled
  - Added proper validation and error messages with Alert components
  - Sign-in page now hides sign-up link when in invitation-only mode without a token

## 6. Security Enhancements

- [ ] **Implement MFA requirements for admin actions:**
  - Ensure invitation management requires MFA verification
  - Add appropriate session checks

- [ ] **Add audit logging:**
  - Track invitation creation, acceptance, and revocation
  - Implement structured logging with user context

## 7. Testing

- [ ] **Write unit tests:**
  - Test invitation creation/revocation
  - Test RLS policies
  - Test token validation

- [ ] **Create end-to-end tests:**
  - Test the full invitation flow
  - Test edge cases (expired invites, multiple invites to same email, etc.)

## 8. Documentation

- [ ] **Update user documentation:**
  - Document invitation process for administrators
  - Create user guide for accepting invitations

- [ ] **Update developer documentation:**
  - Document new database schema
  - Document server actions and components

## Implementation Notes

- ✅ Created dedicated namespace/directory `personal-invitations` for all related functionality
- ✅ Used UUIDs for secure token generation via Node.js crypto's `randomUUID()`
- ✅ Server actions follow Makerkit's pattern with `enhanceAction` for validation and auth
- ✅ Added structured logging with context throughout all server actions
- ✅ Email service uses React Email templates with i18n integration
- ✅ Changed `account_id` to `invited_account_id` for clearer semantics

### Client Components Strategy
- Follow Makerkit's React Query patterns for data fetching
- Use `useQuery` hooks for listing personal invitations
- Use `useMutation` for creating and revoking invitations

### Authentication Integration
- Modify sign-up flow to validate invitation tokens
- Update link on authentication pages to hide direct sign-up when invitation-only mode is enabled
- Add clear error messages for invalid or expired tokens

### Security Considerations
- Maintain proper error handling and user feedback
- Consider implementing rate limiting for invitation creation to prevent abuse
