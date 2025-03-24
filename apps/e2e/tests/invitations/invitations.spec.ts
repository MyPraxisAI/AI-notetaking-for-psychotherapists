import { Page, expect, test } from '@playwright/test';

import { InvitationsPageObject } from './invitations.po';

test.describe('Invitations', () => {
  let page: Page;
  let invitations: InvitationsPageObject;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    invitations = new InvitationsPageObject(page);

    await invitations.setup();
  });

  // Reset the state by navigating to members page before each test
  // This ensures we have a clean state for each test
  test.beforeEach(async () => {
    await invitations.navigateToMembers();
    
    // Check if there are any existing invitations and delete them
    const invitationCount = await invitations.getInvitations().count();
    if (invitationCount > 0) {
      console.log(`Cleaning up ${invitationCount} existing invitations...`);
      
      // Get all invitation emails
      const emails = await invitations.getInvitations().allTextContents();
      
      // Delete each invitation
      for (const email of emails) {
        if (email) {
          await invitations.deleteInvitation(email.trim());
        }
      }
      
      // Verify all invitations are deleted
      await expect(invitations.getInvitations()).toHaveCount(0);
    }
  });

  test('users can delete invites', async () => {
    await invitations.navigateToMembers();
    await invitations.openInviteForm();

    const email = invitations.auth.createRandomEmail();

    const invites = [
      {
        email,
        role: 'member',
      },
    ];

    await invitations.inviteMembers(invites);

    await expect(invitations.getInvitations()).toHaveCount(1);

    await invitations.deleteInvitation(email);

    await expect(invitations.getInvitations()).toHaveCount(0);
  });

  test('users can update invites', async () => {
    await invitations.navigateToMembers();
    await invitations.openInviteForm();

    const email = invitations.auth.createRandomEmail();

    const invites = [
      {
        email,
        role: 'member',
      },
    ];

    await invitations.inviteMembers(invites);

    await expect(invitations.getInvitations()).toHaveCount(1);

    await invitations.updateInvitation(email, 'owner');

    const row = invitations.getInvitationRow(email);

    await expect(row.locator('[data-test="member-role-badge"]')).toHaveText(
      'Owner',
    );
  });

  test('user cannot invite a member of the team again', async ({ page }) => {
    await invitations.navigateToMembers();

    const email = invitations.auth.createRandomEmail();

    const invites = [
      {
        email,
        role: 'member',
      },
    ];

    await invitations.openInviteForm();
    await invitations.inviteMembers(invites);

    await expect(invitations.getInvitations()).toHaveCount(1);

    // Try to invite the same member again
    // This should fail
    await invitations.openInviteForm();
    await invitations.inviteMembers(invites);
    await page.waitForTimeout(500);
    await expect(invitations.getInvitations()).toHaveCount(1);
  });
});

test.describe.serial('Full Invitation Flow', () => {
  let page: Page;
  let invitations: InvitationsPageObject;

  test.beforeAll(async ({ browser }) => {
    page = await browser.newPage();
    invitations = new InvitationsPageObject(page);

    await invitations.setup();
  });

  // Reset the state by navigating to members page before each test
  // This ensures we have a clean state for each test
  test.beforeEach(async () => {
    await invitations.navigateToMembers();
    
    // Check if there are any existing invitations and delete them
    const invitationCount = await invitations.getInvitations().count();
    if (invitationCount > 0) {
      console.log(`Cleaning up ${invitationCount} existing invitations...`);
      
      // Get all invitation emails
      const emails = await invitations.getInvitations().allTextContents();
      
      // Delete each invitation
      for (const email of emails) {
        if (email) {
          await invitations.deleteInvitation(email.trim());
        }
      }
      
      // Verify all invitations are deleted
      await expect(invitations.getInvitations()).toHaveCount(0);
    }
  });

  test('should invite users and let users accept an invite', async ({ }) => {
    // Skip this test in CI environments
    test.skip(!!process.env.CI, 'Skipping invitation acceptance test in CI environmen because on small github runner it always fails');
    await invitations.navigateToMembers();

    const invites = [
      {
        email: invitations.auth.createRandomEmail(),
        role: 'member',
      },
      {
        email: invitations.auth.createRandomEmail(),
        role: 'member',
      },
    ];

    await invitations.openInviteForm();
    await invitations.inviteMembers(invites);

    const firstEmail = invites[0]!.email;

    await expect(invitations.getInvitations()).toHaveCount(2);

    // sign out and sign in with the first email
    await page.context().clearCookies();
    await page.reload();

    console.log(`Finding email to ${firstEmail} ...`);

    await invitations.auth.visitConfirmEmailLink(firstEmail);

    console.log(`Signing up with ${firstEmail} ...`);

    await invitations.auth.signUp({
      email: firstEmail,
      password: 'password',
      repeatPassword: 'password',
    });

    await invitations.auth.visitConfirmEmailLink(firstEmail);

    console.log(`Accepting invitation as ${firstEmail}`);

    await invitations.acceptInvitation();

    await invitations.teamAccounts.openAccountsSelector();

    await expect(invitations.teamAccounts.getTeams()).toHaveCount(1);
  });
});
