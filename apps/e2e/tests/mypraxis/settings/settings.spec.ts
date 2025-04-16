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
    
    // Update the full name to "Ziggy Freud"
    const newFullName = 'Ziggy Freud';
    await settings.updateFullName(newFullName);
    
    // Update the professional credentials to "MD Ph.D"
    const newCredentials = 'MD Ph.D';
    await settings.updateCredentials(newCredentials);
    
    // Select Australia as the country
    const newCountry = 'Australia';
    await settings.selectCountry(newCountry);
    
    // Verify that the therapist name was updated immediately in the sidebar
    const sidebarDisplayedName = await settings.getSidebarTherapistName();
    // Expected format: "Ziggy F" (first name + first letter of last name)
    expect(sidebarDisplayedName).toBe("Ziggy F");

    // Update the avatar to a red image
    await settings.updateAvatarToRedImage();
    
    // Verify that the avatar was updated immediately after upload
    const isAvatarUpdatedAfterUpload = await settings.isAvatarUpdated();
    expect(isAvatarUpdatedAfterUpload).toBe(true);

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
    
    // Verify that the credentials persisted
    const credentialsInput = page.locator('[data-test="settings-credentials-input"]');
    await expect(credentialsInput).toHaveValue(newCredentials);
    
    // Verify that the country selection persisted
    const selectedCountry = await settings.getSelectedCountry();
    console.log(`Selected country after login: "${selectedCountry}"`);
    expect(selectedCountry).toBe(newCountry);
    
    // Verify that the avatar was updated
    const isAvatarUpdated = await settings.isAvatarUpdated();
    console.log(`Is avatar updated? ${isAvatarUpdated}`);
    expect(isAvatarUpdated).toBe(true);
    
    // Verify that the therapist name is still updated in the sidebar after login
    const sidebarDisplayedNameAfterLogin = await settings.getSidebarTherapistName();
    console.log(`Sidebar displayed name after login: "${sidebarDisplayedNameAfterLogin}"`);
    // Expected format: "Ziggy F" (first name + first letter of last name)
    expect(sidebarDisplayedNameAfterLogin).toBe("Ziggy F");
  });
});
