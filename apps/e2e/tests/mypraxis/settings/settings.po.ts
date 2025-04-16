import { Page } from '@playwright/test';
import { AuthPageObject } from '../../authentication/auth.po';
import { clickMenuItemWithResponsiveHandling } from '../../utils/menu-helpers';
import path from 'path';

export class SettingsPageObject {
  private readonly page: Page;
  private readonly auth: AuthPageObject;
  
  // Path to the red square PNG file using relative path
  private readonly redSquarePath = path.join(__dirname, '../../fixtures/red-square.png');

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
  
  /**
   * Updates the professional credentials in the settings page
   * @param credentials The new credentials to set
   */
  async updateCredentials(credentials: string) {
    // Locate the credentials input field
    const credentialsInput = this.page.locator('[data-test="settings-credentials-input"]');
    
    // Clear the existing value and enter the new value
    await credentialsInput.clear();
    await credentialsInput.fill(credentials);
    
    // Trigger blur to save the changes
    await credentialsInput.blur();
    
    // Wait for the save animation (checkmark) to appear and disappear
    await this.page.waitForTimeout(1500);
  }
  
  /**
   * Selects a country from the country dropdown
   * @param countryName The name of the country to select (e.g., "Australia")
   */
  async selectCountry(countryName: string) {
    try {
      // Click on the country dropdown to open it
      await this.page.locator('[data-test="settings-country-select"]').click();
      
      // Wait for the dropdown to appear
      await this.page.waitForTimeout(500);
      
      // Click on the country option by its visible text
      await this.page.getByRole('option', { name: countryName }).click();
      
      // Wait for the save animation (checkmark) to appear and disappear
      await this.page.waitForTimeout(1500);
      
      return true;
    } catch (error) {
      console.error(`Error selecting country ${countryName}:`, error);
      return false;
    }
  }
  
  /**
   * Gets the currently selected country from the country dropdown
   * @returns Promise<string | null> The selected country or null if not found
   */
  async getSelectedCountry(): Promise<string | null> {
    try {
      // Get the text from the country select trigger
      const countrySelectTrigger = this.page.locator('[data-test="settings-country-select"]');
      await countrySelectTrigger.waitFor({ state: 'visible', timeout: 5000 });
      
      // Get the text content of the select trigger (which shows the selected value)
      const selectedCountry = await countrySelectTrigger.textContent();
      return selectedCountry ? selectedCountry.trim() : null;
    } catch (error) {
      console.error('Error getting selected country:', error);
      return null;
    }
  }
  
  /**
   * Selects a primary therapeutic approach from the dropdown
   * @param approachName The name of the therapeutic approach to select (e.g., "Gestalt Therapy")
   */
  async selectTherapeuticApproach(approachName: string) {
    try {
      // Click on the primary therapeutic approach dropdown to open it
      await this.page.locator('[data-test="settings-primary-therapeutic-approach-select"]').click();
      
      // Wait for the dropdown to appear
      await this.page.waitForTimeout(500);
      
      // Click on the approach option by its visible text
      await this.page.getByRole('option', { name: approachName }).click();
      
      // Wait for the save animation (checkmark) to appear and disappear
      await this.page.waitForTimeout(1500);
      
      return true;
    } catch (error) {
      console.error(`Error selecting therapeutic approach ${approachName}:`, error);
      return false;
    }
  }
  
  /**
   * Gets the currently selected primary therapeutic approach
   * @returns Promise<string | null> The selected approach or null if not found
   */
  async getSelectedTherapeuticApproach(): Promise<string | null> {
    try {
      // Get the text from the primary therapeutic approach select trigger
      const approachSelectTrigger = this.page.locator('[data-test="settings-primary-therapeutic-approach-select"]');
      await approachSelectTrigger.waitFor({ state: 'visible', timeout: 5000 });
      
      // Get the text content of the select trigger (which shows the selected value)
      const selectedApproach = await approachSelectTrigger.textContent();
      return selectedApproach ? selectedApproach.trim() : null;
    } catch (error) {
      console.error('Error getting selected therapeutic approach:', error);
      return null;
    }
  }
  
  /**
   * Adds a secondary therapeutic approach
   * @param approachName The name of the therapeutic approach to add (e.g., "Jungian Analysis")
   */
  async addSecondaryTherapeuticApproach(approachName: string) {
    try {
      // Click on the secondary therapeutic approach dropdown to open it
      await this.page.locator('[data-test="settings-secondary-therapeutic-approach-select"]').click();
      
      // Wait for the dropdown to appear
      await this.page.waitForTimeout(500);
      
      // Click on the approach option by its visible text
      await this.page.getByRole('option', { name: approachName }).click();
      
      // Wait for the save animation (checkmark) to appear and disappear
      await this.page.waitForTimeout(1500);
      
      return true;
    } catch (error) {
      console.error(`Error adding secondary therapeutic approach ${approachName}:`, error);
      return false;
    }
  }
  
  /**
   * Gets the list of selected secondary therapeutic approaches
   * @returns Promise<string[]> Array of selected secondary approaches
   */
  async getSecondaryTherapeuticApproaches(): Promise<string[]> {
    try {
      // Find all secondary approach tags using the data-test attribute
      const approachTags = this.page.locator('[data-test="settings-secondary-approach-tag"]');
      
      // Get the count of tags
      const count = await approachTags.count();
      
      // Get the text content of each tag
      const approaches: string[] = [];
      for (let i = 0; i < count; i++) {
        const text = await approachTags.nth(i).textContent();
        if (text) {
          // Remove the 'X' button text if present
          const cleanText = text.replace(/[×✕✖]/g, '').trim();
          approaches.push(cleanText);
        }
      }
      
      return approaches;
    } catch (error) {
      console.error('Error getting secondary therapeutic approaches:', error);
      return [];
    }
  }
  
  /**
   * Updates the profile avatar to a red square image
   */
  async updateAvatarToRedImage() {
    try {
      // Find the file input element for avatar upload
      const fileInput = this.page.locator('input[type="file"][accept="image/*"]');
      
      // Set the file to upload
      await fileInput.setInputFiles(this.redSquarePath);
      
      console.log('Avatar file uploaded successfully');
      
      // Wait for the upload to complete and the avatar to update
      await this.page.waitForTimeout(2000);
    } catch (error) {
      console.error('Failed to update avatar:', error);
      throw error;
    }
  }
  
  /**
   * Checks if the avatar has been successfully updated with a custom image
   * @returns Promise<boolean> True if the avatar has been updated with a custom image
   */
  async isAvatarUpdated(): Promise<boolean> {
    try {
      // Navigate to a page where the sidebar is visible
      await this.page.goto('/home/mypraxis');
      
      // Wait for the page to load
      await this.page.waitForLoadState('networkidle');
      
      // Use the data-test attribute to find the sidebar avatar
      const avatarImage = this.page.locator('[data-test="sidebar-avatar-image"]');
      
      // Wait for the avatar to be visible
      await avatarImage.waitFor({ state: 'visible', timeout: 10000 });
      
      // Get the src attribute of the avatar image
      const srcAttribute = await avatarImage.getAttribute('src');
      
      if (!srcAttribute) {
        console.log('No src attribute found on avatar image');
        return false;
      }
            
      // Check if the avatar URL indicates a custom uploaded image
      const isUpdated = await this.page.evaluate((src) => {
        // Check if the URL contains storage/v1/object/public - indicating a user-uploaded image
        const isStorageUrl = src.includes('storage/v1/object/public');
        
        // Check if the URL contains a timestamp parameter or other indicators of a fresh upload
        const hasTimestamp = src.includes('?');
        
        // Consider the avatar updated if it's a storage URL with a timestamp parameter
        return isStorageUrl && hasTimestamp;
      }, srcAttribute);
      
      return isUpdated;
    } catch (error) {
      console.error('Error in isAvatarUpdated:', error);
      return false;
    }
  }
  
  /**
   * Gets the therapist name currently displayed in the sidebar
   * @returns Promise<string | null> The displayed therapist name or null if not found
   */
  async getSidebarTherapistName(): Promise<string | null> {
    try {
      // Navigate to a page where the sidebar is visible
      await this.page.goto('/home/mypraxis');
      
      // Wait for the page to load
      await this.page.waitForLoadState('networkidle');
      
      // Use the data-test attribute to find the sidebar therapist name
      const nameElement = this.page.locator('[data-test="sidebar-therapist-name"]');
      
      // Wait for the name element to be visible
      await nameElement.waitFor({ state: 'visible', timeout: 10000 });
      
      // Get the text content of the name element
      const displayedName = await nameElement.textContent();
      
      if (!displayedName) {
        console.log('No text content found in therapist name element');
        return null;
      }
      
      return displayedName.trim();
    } catch (error) {
      console.error('Error in getSidebarTherapistName:', error);
      return null;
    }
  }

  /**
   * Toggles the 24-hour clock setting
   * @returns Promise<boolean> True if the operation was successful
   */
  async toggle24HourClock(): Promise<boolean> {
    try {
      // Click on the 24-hour clock checkbox
      await this.page.locator('[data-test="settings-24hr-clock-checkbox"]').click();
      
      // Wait for the save animation (checkmark) to appear and disappear
      await this.page.waitForTimeout(1500);
      
      return true;
    } catch (error) {
      console.error('Error toggling 24-hour clock setting:', error);
      return false;
    }
  }

  /**
   * Toggles the US date format setting
   * @returns Promise<boolean> True if the operation was successful
   */
  async toggleUSDateFormat(): Promise<boolean> {
    try {
      // Click on the US date format checkbox
      await this.page.locator('[data-test="settings-us-date-format-checkbox"]').click();
      
      // Wait for the save animation (checkmark) to appear and disappear
      await this.page.waitForTimeout(1500);
      
      return true;
    } catch (error) {
      console.error('Error toggling US date format setting:', error);
      return false;
    }
  }

  /**
   * Gets the current state of the 24-hour clock checkbox
   * @returns Promise<boolean> True if the checkbox is checked
   */
  async is24HourClockEnabled(): Promise<boolean> {
    try {
      const checkbox = this.page.locator('[data-test="settings-24hr-clock-checkbox"]');
      return await checkbox.isChecked();
    } catch (error) {
      console.error('Error checking 24-hour clock state:', error);
      return false;
    }
  }

  /**
   * Gets the current state of the US date format checkbox
   * @returns Promise<boolean> True if the checkbox is checked
   */
  async isUSDateFormatEnabled(): Promise<boolean> {
    try {
      const checkbox = this.page.locator('[data-test="settings-us-date-format-checkbox"]');
      return await checkbox.isChecked();
    } catch (error) {
      console.error('Error checking US date format state:', error);
      return false;
    }
  }

  /**
   * Updates the password in the settings page
   * @param newPassword The new password to set
   * @param confirmPassword The confirmation of the new password (defaults to the same as newPassword)
   * @returns Promise<boolean> True if the operation was successful
   */
  async updatePassword(newPassword: string, confirmPassword: string = newPassword): Promise<boolean> {
    try {
      // Enter the new password
      const passwordInput = this.page.locator('[data-test="settings-password-input"]');
      await passwordInput.fill(newPassword);
      
      // Enter the confirmation password
      const confirmPasswordInput = this.page.locator('[data-test="settings-confirm-password-input"]');
      await confirmPasswordInput.fill(confirmPassword);
      
      // Click the change password button
      const changePasswordButton = this.page.locator('[data-test="settings-change-password-button"]');
      await changePasswordButton.click();
      
      // Wait for the save animation (checkmark) to appear and disappear
      await this.page.waitForTimeout(2000);
      
      return true;
    } catch (error) {
      console.error('Error updating password:', error);
      return false;
    }
  }
}
