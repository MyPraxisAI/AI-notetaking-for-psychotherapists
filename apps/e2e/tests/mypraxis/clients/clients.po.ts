import { Page } from '@playwright/test';
import { AuthPageObject } from '../../authentication/auth.po';
import { clickMenuItemWithResponsiveHandling } from '../../utils/menu-helpers';

export class ClientsPageObject {
  private readonly page: Page;
  private readonly auth: AuthPageObject;

  constructor(page: Page) {
    this.page = page;
    this.auth = new AuthPageObject(page);
  }

  /**
   * Navigate to the clients page
   */
  async goToClientsPage() {
    // Use the improved clickMenuItemWithResponsiveHandling utility
    await clickMenuItemWithResponsiveHandling(
      this.page,
      '[data-test="clients-nav-button"]'
    );
    
    // Wait for the clients page to load
    await this.page.waitForTimeout(1000);
  }

  /**
   * Click the "New Client" button to open the client creation form
   */
  async clickNewClientButton() {
    await this.page.locator('[data-test="new-client-button"]').click();
    
    // Wait for the client form to appear
    await this.page.waitForSelector('[data-test="client-form"]', { state: 'visible' });
  }

  /**
   * Fill in the client form with the provided details and trigger auto-save on blur
   * @param clientData The client data to fill in
   * @returns Promise<boolean> True if the operation was successful
   */
  async fillClientForm(clientData: {
    fullName: string;
    email: string;
    phone: string;
  }): Promise<boolean> {
    try {
      // Fill in the full name
      const fullNameInput = this.page.locator('[data-test="client-fullname-input"]');
      await fullNameInput.clear();
      await fullNameInput.fill(clientData.fullName);
      await fullNameInput.blur();

      await this.page.waitForTimeout(1000);

      // Fill in the email
      const emailInput = this.page.locator('[data-test="client-email-input"]');
      await emailInput.clear();
      await emailInput.fill(clientData.email);
      await emailInput.blur();

      await this.page.waitForTimeout(1000);

      // Fill in the phone number
      const phoneInput = this.page.locator('[data-test="client-phone-input"]');
      await phoneInput.clear();
      await phoneInput.fill(clientData.phone);
      await phoneInput.blur();
      
      // Wait for the save animation (checkmark) to appear and disappear
      await this.page.waitForTimeout(1000);
      
      return true;
    } catch (error) {
      console.error('Error filling client form:', error);
      return false;
    }
  }



  /**
   * Get the client row by name
   * @param fullName The full name of the client to find
   * @returns Promise<any> The client row element or null if not found
   */
  async getClientRowByName(fullName: string) {
    try {
      // Find all client rows and filter by the one containing the full name
      const clientRows = this.page.locator(`[data-test^="client-row-"]`);
      const count = await clientRows.count();
      
      for (let i = 0; i < count; i++) {
        const row = clientRows.nth(i);
        const nameElement = row.locator('[data-test="client-name-cell"]');
        const name = await nameElement.textContent();
        
        if (name?.trim() === fullName) {
          return row;
        }
      }
      
      return null;
    } catch (error) {
      console.error(`Error finding client row for ${fullName}:`, error);
      return null;
    }
  }

  /**
   * Get client details from the client list
   * @param fullName The full name of the client to get details for
   * @returns Promise<{fullName: string, email: string, phone: string} | null> The client details or null if not found
   */
  async getClientDetails(fullName: string): Promise<{fullName: string, email: string, phone: string} | null> {
    try {
      // First click on the client row to open the client details
      const clientRow = await this.getClientRowByName(fullName);
      if (!clientRow) {
        return null;
      }
      
      await clientRow.click();
      
      // Wait for the client form to be visible
      await this.page.waitForSelector('[data-test="client-form"]', { state: 'visible' });
      
      // Get the client details from the form
      const displayedName = await this.page.locator('[data-test="client-fullname-input"]').inputValue();
      const email = await this.page.locator('[data-test="client-email-input"]').inputValue();
      const phone = await this.page.locator('[data-test="client-phone-input"]').inputValue();
      
      return {
        fullName: displayedName?.trim() || '',
        email: email?.trim() || '',
        phone: phone?.trim() || ''
      };
    } catch (error) {
      console.error(`Error getting client details for ${fullName}:`, error);
      return null;
    }
  }

  /**
   * Check if a client with the given name exists in the client list
   * @param fullName The full name of the client to check for
   * @returns Promise<boolean> True if the client exists
   */
  async clientExists(fullName: string): Promise<boolean> {
    try {
      const clientRow = await this.getClientRowByName(fullName);
      return clientRow !== null && await clientRow.isVisible();
    } catch (error) {
      console.error(`Error checking if client ${fullName} exists:`, error);
      return false;
    }
  }
}
