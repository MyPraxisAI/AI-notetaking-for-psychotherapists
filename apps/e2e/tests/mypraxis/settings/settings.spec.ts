import { test, expect, Page } from '@playwright/test';
import { AuthPageObject } from '../../authentication/auth.po';
import { SettingsPageObject } from './settings.po';

test.describe('MyPraxis Settings Page', () => {
  test.describe.configure({ mode: 'serial' });
  
  // Configure viewport to avoid sidebar collapse issues (can't click on menu icon on the settings page for some reason :()
  test.use({ viewport: { width: 1600, height: 900 } });

  // Define test constants outside the tests
  const email: string = `test-${Math.random().toString(36).substring(2, 10)}@therapist.org`;
  const password = 'testingpassword';
  
  // Create a user before running any tests
  test.beforeAll(async ({ browser }) => {
    // Create a new context and page for setup
    const context = await browser.newContext();
    const page = await context.newPage();
    const auth = new AuthPageObject(page);
    
    console.log(`Setting up test user with email: ${email}`);
    
    // Create a new user for all tests
    await page.goto('/auth/sign-up');
            
    // Sign up with the new user
    await auth.signUp({
      email,
      password,
      repeatPassword: password
    });
    
    // Visit the confirmation email link
    await auth.visitConfirmEmailLink(email);
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    console.log(`Test user '${email}' created successfully`);
    
    // Clean up
    await context.close();
  });
  
  test('should update properties and persist after logout and login', async ({ page }) => {

    const auth = new AuthPageObject(page);
    const settings = new SettingsPageObject(page);
    
    // Login with the user created in beforeAll
    await page.goto('/auth/sign-in');
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to settings page
    await settings.goToSettings();
    
    // Update the full name
    const newFullName = `Test User ${Math.random().toString(36).substring(2, 6)}`;
    await settings.updateFullName(newFullName);
    console.log(`Updated full name to: ${newFullName}`);
    
    
    
    // Log out
    await auth.signOut();
    
    // Wait to be redirected to the sign-in page
    await page.waitForURL('/auth/sign-in');
    
    // Log back in
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to settings page again
    await settings.goToSettings();
    
    // Verify that the email on the settings page matches the one used for registration
    const emailInput = page.locator('[data-test="settings-email-input"]');
    await expect(emailInput).toHaveValue(email);
    
    // Verify that the full name persisted
    const fullNameInput = page.locator('[data-test="settings-fullname-input"]');
    await expect(fullNameInput).toHaveValue(newFullName);
  });
});
