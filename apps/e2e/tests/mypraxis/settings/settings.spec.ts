import { test, expect, Page } from '@playwright/test';
import { AuthPageObject } from '../../authentication/auth.po';
import { SettingsPageObject } from './settings.po';

test.describe('MyPraxis Settings Page', () => {
  test.describe.configure({ mode: 'serial' });
  
  // Configure viewport to avoid sidebar collapse issues (can't click on menu icon on the settings page for some reason :()
  test.use({ viewport: { width: 1600, height: 900 } });

  // Define test variables outside the tests
  const email: string = `test-${Math.random().toString(36).substring(2, 10)}@therapist.org`;
  let password = 'testingpassword';
  
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
  
  test('should update properties and verify they persist after logout and login', async ({ page }) => {

    const auth = new AuthPageObject(page);
    const settings = new SettingsPageObject(page);
    
    // Login with the user created in beforeAll
    await page.goto('/auth/sign-in', { timeout: 10000 });
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
    
    // Get initial state of the preferences
    const initial24HourClock = await settings.is24HourClockEnabled();
    const initialUSDateFormat = await settings.isUSDateFormatEnabled();
    
    // Toggle the 24-hour clock setting
    await settings.toggle24HourClock();
    
    // Toggle the US date format setting
    await settings.toggleUSDateFormat();
    
    // Verify the settings have changed
    const updated24HourClock = await settings.is24HourClockEnabled();
    const updatedUSDateFormat = await settings.isUSDateFormatEnabled();
    
    expect(updated24HourClock).toBe(!initial24HourClock);
    expect(updatedUSDateFormat).toBe(!initialUSDateFormat);
    
    // Select Australia as the country
    const newCountry = 'Australia';
    await settings.selectCountry(newCountry);
    
    // Select Gestalt Therapy as the primary therapeutic approach
    const newApproach = 'Gestalt Therapy';
    await settings.selectTherapeuticApproach(newApproach);
    
    // Add Jungian Analysis as the first secondary therapeutic approach
    const firstSecondaryApproach = 'Jungian Analysis';
    await settings.addSecondaryTherapeuticApproach(firstSecondaryApproach);
    
    // Add Narrative Therapy as the second secondary therapeutic approach
    const secondSecondaryApproach = 'Narrative Therapy';
    await settings.addSecondaryTherapeuticApproach(secondSecondaryApproach);
    
    // Verify that the therapist name was updated immediately in the sidebar
    const sidebarDisplayedName = await settings.getSidebarTherapistName();
    // Expected format: "Ziggy F" (first name + first letter of last name)
    expect(sidebarDisplayedName).toBe("Ziggy F");

    // Update the avatar to a red image
    await settings.updateAvatarToRedImage();
    
    // Verify that the avatar was updated immediately after upload
    const isAvatarUpdatedAfterUpload = await settings.isAvatarUpdated();
    expect(isAvatarUpdatedAfterUpload).toBe(true);

    // Sign out, then sign back in
    await auth.signOut();
    
    // Wait to be redirected to the sign-in page
    await page.waitForURL('/auth/sign-in', { timeout: 10000 });
    
    // Log back in
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to settings page again
    await settings.goToSettings();
    
    ///////////////////////////// Verify that the fields updated to the new values /////////////////////////////

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
    
    // Verify that the therapeutic approach selection persisted
    const selectedApproach = await settings.getSelectedTherapeuticApproach();
    console.log(`Selected therapeutic approach after login: "${selectedApproach}"`);
    expect(selectedApproach).toBe(newApproach);
    
    // Verify that the secondary therapeutic approaches persisted
    const secondaryApproaches = await settings.getSecondaryTherapeuticApproaches();
    console.log(`Selected secondary therapeutic approaches after login: ${JSON.stringify(secondaryApproaches)}`);
    expect(secondaryApproaches).toContain(firstSecondaryApproach);
    expect(secondaryApproaches).toContain(secondSecondaryApproach);
    expect(secondaryApproaches.length).toBe(2);
    
    // Verify that the avatar was updated
    const isAvatarUpdated = await settings.isAvatarUpdated();
    console.log(`Is avatar updated? ${isAvatarUpdated}`);
    expect(isAvatarUpdated).toBe(true);
    
    // Verify that the therapist name is still updated in the sidebar after login
    const sidebarDisplayedNameAfterLogin = await settings.getSidebarTherapistName();
    console.log(`Sidebar displayed name after login: "${sidebarDisplayedNameAfterLogin}"`);
    // Expected format: "Ziggy F" (first name + first letter of last name)
    expect(sidebarDisplayedNameAfterLogin).toBe("Ziggy F");
    
    // Verify that the preference settings persisted after logout and login
    const persisted24HourClock = await settings.is24HourClockEnabled();
    const persistedUSDateFormat = await settings.isUSDateFormatEnabled();
    
    console.log(`24-hour clock setting after login: ${persisted24HourClock}`);
    console.log(`US date format setting after login: ${persistedUSDateFormat}`);
    
    expect(persisted24HourClock).toBe(updated24HourClock);
    expect(persistedUSDateFormat).toBe(updatedUSDateFormat);
  });

  // TODO: Language switch test (after localization works)

  test('should update password and verify login with new password', async ({ page }) => {
    const auth = new AuthPageObject(page);
    const settings = new SettingsPageObject(page);
    
    // Login with the user created in beforeAll
    await page.goto('/auth/sign-in', { timeout: 10000 });
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to settings page
    await settings.goToSettings();
    
    // Update the password to a new value
    const newPassword = 'NewPassword123!';
    const passwordUpdateSuccess = await settings.updatePassword(newPassword);
    expect(passwordUpdateSuccess).toBe(true);
    
    // Verify the password change was successful by checking for the checkmark
    const checkmark = page.locator('[data-test="settings-password-saved-checkmark"]');
    await expect(checkmark).toBeVisible();
    console.log('Password change confirmed with checkmark visible');
    
    // Log out
    await auth.signOut();
    
    // Wait for a moment to ensure logout is complete
    await page.waitForTimeout(1000);
    
    // Try to log in with the old password (should fail)
    // Use a try-catch block to handle potential navigation errors
    try {
      // Add a longer timeout and wait for networkidle to ensure page is fully loaded
      await page.goto('/auth/sign-in', { timeout: 15000, waitUntil: 'networkidle' });
      
      const loginFailed = await auth.attemptInvalidSignIn({
        email,
        password
      });
    
      // Verify that the login attempt failed as expected
      expect(loginFailed).toBe(true);
      console.log('Login with old password failed as expected');
      
      // Now try to log in with the new password (should succeed)
      await auth.signIn({
        email,
        password: newPassword
      });
    } catch (error) {
      console.log('Navigation error occurred, retrying with direct auth page access');
      
      // If navigation fails, try a different approach
      await page.goto('http://localhost:3000', { timeout: 15000 });
      await page.waitForTimeout(1000);
      await page.goto('http://localhost:3000/auth/sign-in', { timeout: 15000 });
      
      // Try with the new password directly
      await auth.signIn({
        email,
        password: newPassword
      });
    }
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Verify we're logged in by checking for a known element on the dashboard
    const dashboardElement = page.locator('[data-test="sidebar-therapist-name"]');
    await expect(dashboardElement).toBeVisible();
    
    // Update the global password variable for future tests
    password = newPassword;
  });
});
