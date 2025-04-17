import { Page } from '@playwright/test';
import { AuthPageObject } from '../../authentication/auth.po';
import { ClientsPageObject } from '../clients/clients.po';
import { clickMenuItemWithResponsiveHandling } from '../../utils/menu-helpers';

export class SessionsPageObject {
  private readonly page: Page;
  private readonly auth: AuthPageObject;
  private readonly clients: ClientsPageObject;

  constructor(page: Page) {
    this.page = page;
    this.auth = new AuthPageObject(page);
    this.clients = new ClientsPageObject(page);
  }



  /**
   * Click the "Start recording" button to create a new session
   */
  async clickStartRecordingButton(): Promise<boolean> {
    try {
      const recordButton = this.page.locator('[data-test="start-recording-button"]');
      await recordButton.click();
      
      // Wait for the recording interface to appear
      await this.page.waitForSelector('[data-test="recording-interface"]', { state: 'visible', timeout: 5000 });
      
      return true;
    } catch (error) {
      console.error('Error clicking start recording button:', error);
      return false;
    }
  }

  /**
   * Get the list of sessions for the current client
   * @returns Promise<string[]> Array of session titles
   */
  async getSessionsList(): Promise<string[]> {
    try {
      const sessionElements = this.page.locator('[data-test="session-item"]');
      const count = await sessionElements.count();
      
      const sessions: string[] = [];
      for (let i = 0; i < count; i++) {
        const titleElement = sessionElements.nth(i).locator('[data-test="session-title"]');
        const title = await titleElement.textContent();
        if (title) {
          sessions.push(title.trim());
        }
      }
      
      return sessions;
    } catch (error) {
      console.error('Error getting sessions list:', error);
      return [];
    }
  }

  /**
   * Click on a session by its title
   * @param sessionTitle The title of the session to click
   */
  async clickSession(sessionTitle: string): Promise<boolean> {
    try {
      const sessionElement = this.page.locator(`[data-test="session-item"]:has-text("${sessionTitle}")`);
      await sessionElement.click();
      
      // Wait for the session view to load
      await this.page.waitForSelector('[data-test="session-view"]', { state: 'visible' });
      
      return true;
    } catch (error) {
      console.error(`Error clicking session ${sessionTitle}:`, error);
      return false;
    }
  }

  /**
   * Stop the current recording session
   */
  async stopRecording(): Promise<boolean> {
    try {
      const stopButton = this.page.locator('[data-test="stop-recording-button"]');
      await stopButton.click();
      
      // Wait for the recording to stop and process
      await this.page.waitForSelector('[data-test="session-view"]', { state: 'visible', timeout: 10000 });
      
      return true;
    } catch (error) {
      console.error('Error stopping recording:', error);
      return false;
    }
  }

  /**
   * Enter a title for the session
   * @param title The title to set for the session
   */
  async setSessionTitle(title: string): Promise<boolean> {
    try {
      const titleInput = this.page.locator('[data-test="session-title-input"]');
      await titleInput.fill(title);
      await titleInput.blur(); // Trigger save
      
      // Wait for the save to complete
      await this.page.waitForTimeout(1000);
      
      return true;
    } catch (error) {
      console.error(`Error setting session title to ${title}:`, error);
      return false;
    }
  }

  /**
   * Get the current session title
   */
  async getSessionTitle(): Promise<string | null> {
    try {
      const titleElement = this.page.locator('[data-test="session-title"]');
      const title = await titleElement.textContent();
      return title ? title.trim() : null;
    } catch (error) {
      console.error('Error getting session title:', error);
      return null;
    }
  }

  /**
   * Delete the current session
   */
  async deleteSession(): Promise<boolean> {
    try {
      // Click the session options button
      const optionsButton = this.page.locator('[data-test="session-options-button"]');
      await optionsButton.click();
      
      // Click the delete option
      const deleteOption = this.page.locator('[data-test="delete-session-option"]');
      await deleteOption.click();
      
      // Confirm deletion
      const confirmButton = this.page.locator('[data-test="confirm-delete-button"]');
      await confirmButton.click();
      
      // Wait for the deletion to complete
      await this.page.waitForTimeout(1000);
      
      return true;
    } catch (error) {
      console.error('Error deleting session:', error);
      return false;
    }
  }
}
