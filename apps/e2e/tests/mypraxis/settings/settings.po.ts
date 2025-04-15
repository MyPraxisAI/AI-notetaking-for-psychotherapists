import { Page } from '@playwright/test';
import { AuthPageObject } from '../../authentication/auth.po';
import { clickMenuItemWithResponsiveHandling } from '../../utils/menu-helpers';

export class SettingsPageObject {
  private readonly page: Page;
  private readonly auth: AuthPageObject;

  constructor(page: Page) {
    this.page = page;
    this.auth = new AuthPageObject(page);
  }

  // We'll use the AuthPageObject directly for sign-in/sign-up functionality

  async goToSettings() {
    // Use the improved clickMenuItemWithResponsiveHandling utility
    await clickMenuItemWithResponsiveHandling(
      this.page,
      '[data-test="settings-button"]'
    );
    
    // Wait for the settings form to be rendered
    await this.page.waitForTimeout(1000);
  }
  
  /**
   * Updates the full name in the settings page
   * @param fullName The new full name to set
   */
  async updateFullName(fullName: string) {
    // Locate the full name input field
    const fullNameInput = this.page.locator('[data-test="settings-fullname-input"]');
    
    // Clear the existing value and enter the new value
    await fullNameInput.clear();
    await fullNameInput.fill(fullName);
    
    // Trigger blur to save the changes
    await fullNameInput.blur();
    
    // Wait for the save animation (checkmark) to appear and disappear
    await this.page.waitForTimeout(1500);
  }
}
