import { Page } from '@playwright/test';

/**
 * Helper function to click a menu item in the MyPraxis sidebar.
 * Always checks for the menu button first and clicks it if visible, then clicks the target item.
 * 
 * @param page - Playwright Page object
 * @param targetSelector - Data-test selector for the target menu item
 * @param menuButtonSelector - Data-test selector for the menu button (defaults to nav-menu-button)
 */
export async function clickMenuItemWithResponsiveHandling(
  page: Page,
  targetSelector: string,
  menuButtonSelector: string = '[data-test="nav-menu-button"]'
): Promise<void> {
  await page.waitForTimeout(1000);
  console.log(`Attempting to click menu item: ${targetSelector}`);
  
  // Check if the menu button is visible
  const menuButton = page.locator(menuButtonSelector);
  const isMenuButtonVisible = await menuButton.isVisible().catch(() => false);
  
  // Check if the target element is visible
  const targetElement = page.locator(targetSelector);
  const isTargetVisible = await targetElement.isVisible().catch(() => false);
  
  console.log(`Menu button visible: ${isMenuButtonVisible}, Target visible: ${isTargetVisible}`);
  
  if (!isMenuButtonVisible && !isTargetVisible) {
    console.log('Neither menu button nor target are visible, waiting for 5 seconds...');
    await page.waitForTimeout(5000);
  }
  
  // If menu button is visible, click it
  if (await menuButton.isVisible().catch(() => false)) {
    console.log('Clicking menu button to expand sidebar');
    await menuButton.click();
    
    // Wait for the sidebar animation to complete
    await page.waitForTimeout(2000);
  }
  
  // Click target
  try {
    console.log(`Clicking target element: ${targetSelector}`);
    
    // Wait for the target to be visible with a reasonable timeout
    await page.waitForSelector(targetSelector, { state: 'visible', timeout: 5000 });
    
    // Click the target
    await targetElement.click({ timeout: 5000 });
    console.log(`Successfully clicked ${targetSelector}`);
  } catch (error) {
    console.error(`Failed to click ${targetSelector}:`, error);
    throw error;
  }
}
