import { expect, test } from '@playwright/test';

import { AuthPageObject } from './auth.po';

const email = 'owner@makerkit.dev';
const newPassword = (Math.random() * 10000).toString();

test.describe('Password Reset Flow', () => {
  test.describe.configure({ mode: 'serial' });

  test('will reset the password and sign in with new one', async ({ page }) => {
    const auth = new AuthPageObject(page);

    await page.goto('/auth/password-reset');

    await page.fill('[name="email"]', email);
    await page.click('[type="submit"]');

    await auth.visitConfirmEmailLink(email);

    await page.waitForURL('/update-password');

    await auth.updatePassword(newPassword);

    await page
      .locator('a', {
        hasText: 'Back to Home Page',
      })
      .click();

    await page.waitForURL('/home');

    await auth.signOut();

    await page
      .locator('a', {
        hasText: 'Sign in',
      })
      .click();

    await auth.signIn({
      email,
      password: newPassword,
    });

    await page.waitForURL('/home');
  });
});
