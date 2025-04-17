import { test, expect } from '@playwright/test';
import { AuthPageObject } from '../../authentication/auth.po';
import { ClientsPageObject } from './clients.po';

test.describe('MyPraxis Clients Page', () => {
  test.describe.configure({ mode: 'serial' });
  
  // Configure viewport to ensure consistent testing environment
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
    
  test('should navigate to clients page from settings page', async ({ page }) => {
    const auth = new AuthPageObject(page);
    const clients = new ClientsPageObject(page);
    
    // Login with the user created in beforeAll
    await page.goto('/auth/sign-in', { timeout: 10000 });
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // First navigate to settings page
    await page.locator('[data-test="settings-nav-button"]').click();
    await page.waitForTimeout(1000);
    
    // Then navigate to clients page
    await clients.goToClientsPage();
    
    // Verify we're on the clients page by checking for the new client button
    const newClientButton = page.locator('[data-test="new-client-button"]');
    await expect(newClientButton).toBeVisible();
    
    console.log('Successfully navigated from settings to clients page');
  });
  
  test('should create a new client and verify persistence after logout', async ({ page }) => {
    const auth = new AuthPageObject(page);
    const clients = new ClientsPageObject(page);
    
    // Login with the user created in beforeAll
    await page.goto('/auth/sign-in', { timeout: 10000 });
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to the clients page
    await clients.goToClientsPage();
    
    // Generate unique client data for this test
    const clientData = {
      fullName: `Test Client ${Math.random().toString(36).substring(2, 8)}`,
      email: `client-${Math.random().toString(36).substring(2, 8)}@example.com`,
      phone: `+972541234567`
    };
    
    console.log('Creating client with data:', clientData);
    
    // Click the New Client button
    await clients.clickNewClientButton();
    
    // Fill in the client form (which auto-saves on blur)
    const formFilled = await clients.fillClientForm(clientData);
    expect(formFilled).toBe(true);
    
    // Wait for the client to appear in the list
    await page.waitForTimeout(1000);
    
    // Verify the client exists in the list
    const clientExists = await clients.clientExists(clientData.fullName);
    expect(clientExists).toBe(true);
    
    // Get the client details from the list
    const clientDetails = await clients.getClientDetails(clientData.fullName);
    expect(clientDetails).not.toBeNull();
    
    // Verify the client details match what we entered
    expect(clientDetails?.fullName).toBe(clientData.fullName);
    expect(clientDetails?.email).toBe(clientData.email);
    expect(clientDetails?.phone).toBe(clientData.phone);
    
    // Log out
    await auth.signOut();
    
    // Wait for a moment to ensure logout is complete
    await page.waitForTimeout(1000);
    
    // Log back in
    await page.goto('/auth/sign-in', { timeout: 10000 });
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to the clients page again
    await clients.goToClientsPage();
    
    // Verify the client still exists
    const clientExistsAfterLogin = await clients.clientExists(clientData.fullName);
    expect(clientExistsAfterLogin).toBe(true);
    
    // Get the client details again
    const clientDetailsAfterLogin = await clients.getClientDetails(clientData.fullName);
    expect(clientDetailsAfterLogin).not.toBeNull();
    
    // Verify the client details still match what we entered
    expect(clientDetailsAfterLogin?.fullName).toBe(clientData.fullName);
    expect(clientDetailsAfterLogin?.email).toBe(clientData.email);
    expect(clientDetailsAfterLogin?.phone).toBe(clientData.phone);
    
    console.log('Client data persisted correctly after logout and login');
  });
  
  test('should delete a client', async ({ page }) => {
    const auth = new AuthPageObject(page);
    const clients = new ClientsPageObject(page);
    
    // Login with the user created in beforeAll
    await page.goto('/auth/sign-in', { timeout: 10000 });
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to the clients page
    await clients.goToClientsPage();
    
    // Create a client to delete
    const clientData = {
      fullName: `Delete Test ${Math.random().toString(36).substring(2, 8)}`,
      email: `delete-${Math.random().toString(36).substring(2, 8)}@example.com`,
      phone: `+972541234567`
    };
    
    console.log('Creating client to delete:', clientData);
    
    // Create the client
    await clients.clickNewClientButton();
    await clients.fillClientForm(clientData);
    
    // Wait for the client to appear in the list
    await page.waitForTimeout(1000);
    
    // Verify the client exists
    const clientExists = await clients.clientExists(clientData.fullName);
    expect(clientExists).toBe(true);
    
    // Click on the client to open the client profile
    const clientRow = await clients.getClientRowByName(clientData.fullName);
    expect(clientRow).not.toBeNull();
    if (!clientRow) {
      throw new Error(`Client row for ${clientData.fullName} not found`);
    }
    await clientRow.click();
    
    // Wait for the client profile to load
    await page.waitForSelector('[data-test="client-form"]', { state: 'visible' });
    await page.waitForTimeout(1000); // Additional wait to ensure UI is stable
    
    // Delete the client
    await page.locator('[data-test="client-more-options"]').click();
    await page.waitForTimeout(500); // Wait for dropdown to appear
    await page.locator('[data-test="delete-client-button"]').click();
    await page.waitForTimeout(500); // Wait for confirmation dialog
    
    // Type the client name in the confirmation dialog
    const confirmInput = page.locator('input[placeholder="Enter client name"]');
    await confirmInput.fill(clientData.fullName);
    
    // Click the confirm delete button
    await page.locator('[data-test="confirm-delete-button"]').click();
    
    // Wait for the deletion to complete
    await page.waitForTimeout(1000);
    
    // Verify the client no longer exists
    const clientExistsAfterDelete = await clients.clientExists(clientData.fullName);
    expect(clientExistsAfterDelete).toBe(false);
    
    console.log('Client deleted successfully');
  });
});
