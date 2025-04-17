import { test, expect } from '@playwright/test';
import { AuthPageObject } from '../../authentication/auth.po';
import { ClientsPageObject } from '../clients/clients.po';
import { SessionsPageObject } from './sessions.po';

function getTodayString(): string {
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

test.describe('MyPraxis Sessions', () => {
  test.describe.configure({ mode: 'serial' });
  
  // Configure viewport to ensure consistent testing environment
  test.use({ viewport: { width: 1600, height: 900 } });

  // Define test variables outside the tests
  const email: string = `test-${Math.random().toString(36).substring(2, 10)}@therapist.org`;
  const password = 'testingpassword';
  const clientData = {
    fullName: `Test Client ${Math.random().toString(36).substring(2, 8)}`,
    email: `client-${Math.random().toString(36).substring(2, 8)}@example.com`,
    phone: '+972541234567'
  };
  
  // Create a user and client before running any tests
  test.beforeAll(async ({ browser }) => {
    // Create a new context and page for setup
    const context = await browser.newContext();
    const page = await context.newPage();
    const auth = new AuthPageObject(page);
    const clients = new ClientsPageObject(page);
    
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
    
    // Create a client for testing sessions
    console.log('Creating test client with data:', clientData);
    
    // Navigate to the clients page
    await clients.goToClientsPage();
    
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
    
    console.log(`Test client '${clientData.fullName}' created successfully`);
    
    // Clean up
    await context.close();
  });
  
  test('should navigate to client and see empty sessions list', async ({ page }) => {
    const auth = new AuthPageObject(page);
    const sessions = new SessionsPageObject(page);
    const clients = new ClientsPageObject(page);
    
    // Login with the user created in beforeAll
    await page.goto('/auth/sign-in', { timeout: 10000 });
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to the client
    await clients.navigateToClient(clientData.fullName);
    
    // Get the sessions list (should be empty for a new client)
    const sessionsList = await sessions.getSessionsList();
    
    // Verify the sessions list is empty for the new client
    expect(sessionsList.length).toBe(0);
    
    // The test passes if we can navigate to the client successfully and the sessions list is empty
  });
  
  test('should be able to create and update a session', async ({ page }) => {
    const auth = new AuthPageObject(page);
    const sessions = new SessionsPageObject(page);
    const clients = new ClientsPageObject(page);
    
    // Login with the user created in beforeAll
    await page.goto('/auth/sign-in', { timeout: 10000 });
    await auth.signIn({
      email,
      password
    });
    
    // Wait to be redirected to the home page
    await page.waitForURL('/home/mypraxis');
    
    // Navigate to the client
    await clients.navigateToClient(clientData.fullName);
    
    // Check if the recording button is visible
    const recordButton = page.locator('[data-test="start-recording-button"]');
    await expect(recordButton).toBeVisible();
    
    // Check if the button is enabled
    const isDisabled = await recordButton.getAttribute('disabled');
    expect(isDisabled).toBeNull(); // Button should not be disabled

    // Click the record button to create a new session
    await recordButton.click();
    
    // Wait for the session title element to appear (indicates a new session was created)
    const sessionTitleElement = page.locator('[data-test="session-title"]');
    await sessionTitleElement.waitFor({ state: 'visible', timeout: 5000 });

    // Optionally, click to edit the session title
    await sessionTitleElement.click();

    // Now wait for the input to appear
    const titleInput = page.locator('[data-test="session-title-input"]');
    await titleInput.waitFor({ state: 'visible', timeout: 5000 });

    // Enter a session title
    const sessionTitle = `Test Session ${Math.random().toString(36).substring(2, 8)}`;
    await titleInput.fill(sessionTitle);
    await titleInput.blur(); // Trigger save
    await page.waitForTimeout(1000); // Wait for save to complete

    // Verify the session title was updated
    const actualTitle = await sessionTitleElement.textContent();
    expect(actualTitle?.trim()).toBe(sessionTitle);

    // Verify the session date in the session view is today's date
    const sessionDate = await page.locator('[data-test="session-date"]').textContent();
    const todayStr = getTodayString();
    expect(sessionDate?.trim()).toBe(todayStr);

    // Verify the session title in the session list was also updated
    const sessionListTitle = page.locator('[data-test="sessions-list-title"]', { hasText: sessionTitle });
    await expect(sessionListTitle).toBeVisible();

    // Verify the session date in the session list is also today's date
    const sessionListDate = await page.locator('[data-test="sessions-list-date"]', { hasText: todayStr }).textContent();
    expect(sessionListDate?.trim()).toBe(todayStr);

    // Switch to "Summary & Notes" tab and add a note
    await page.locator('[data-test="session-tab-summary"]').click();
    const note = 'This is a test note.';
    // Click the add note button if present to reveal the input
    const addNoteButton = page.locator('[data-test="session-add-note-button"]');
    await addNoteButton.click();
    const noteInput = page.locator('[data-test="session-note-input"]');
    await noteInput.waitFor({ state: 'visible', timeout: 3000 });
    await noteInput.fill(note);
    await noteInput.blur();
    // Wait for the input to disappear and the note to be rendered
    await noteInput.waitFor({ state: 'detached', timeout: 3000 });
    const noteValue = page.locator('[data-test="session-note-value"]');
    await expect(noteValue).toHaveText(note);

    // Switch to "Transcript" tab and add a transcript
    await page.locator('[data-test="session-tab-transcript"]').click();
    const transcript = 'This is a test transcript.';
    // Click the add transcript button if present to reveal the input
    const addTranscriptButton = page.locator('[data-test="session-add-transcript-button"]');
    await addTranscriptButton.click();
    const transcriptInput = page.locator('[data-test="session-transcript-input"]');
    await transcriptInput.waitFor({ state: 'visible', timeout: 3000 });
    await transcriptInput.fill(transcript);
    await transcriptInput.blur();
    // Wait for the input to disappear and the transcript to be rendered
    await transcriptInput.waitFor({ state: 'detached', timeout: 3000 });
    const transcriptValue = page.locator('[data-test="session-transcript-value"]');
    await expect(transcriptValue).toHaveText(transcript);

    ///////////////////////////// Logout and Login /////////////////////////////

    // Log out
    await auth.signOut();
    await page.waitForTimeout(1000);

    // Log back in
    await page.goto('/auth/sign-in', { timeout: 10000 });
    await auth.signIn({ email, password });
    await page.waitForURL('/home/mypraxis');

    ////////////////////////// Revalidate session data ///////////////////////////////////
  
    // Navigate to sessions page and open the same session by title
    await sessions.clickSession(sessionTitle);

    // Re-validate session title
    const sessionTitleEl2 = page.locator('[data-test="session-title"]');
    await expect(sessionTitleEl2).toHaveText(sessionTitle);

    // Re-validate session date
    const sessionDateEl2 = page.locator('[data-test="session-date"]');
    if (sessionDate) {
      await expect(sessionDateEl2).toHaveText(sessionDate);
    }

    // Re-validate note
    await page.locator('[data-test="session-tab-summary"]').click();
    const noteValue2 = page.locator('[data-test="session-note-value"]');
    await expect(noteValue2).toHaveText(note);

    // Re-validate transcript
    await page.locator('[data-test="session-tab-transcript"]').click();
    const transcriptValue2 = page.locator('[data-test="session-transcript-value"]');
    await expect(transcriptValue2).toHaveText(transcript);
  });
});
