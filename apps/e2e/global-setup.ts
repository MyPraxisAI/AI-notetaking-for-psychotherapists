import { FullConfig } from '@playwright/test';

/**
 * Global setup for Playwright tests
 * This runs once before all tests
 */
async function globalSetup(config: FullConfig) {
  // Set environment variable to enable mocking of all external services
  process.env.MOCK_EXTERNAL_SERVICES = 'true';
  
  console.log('🔄 Global setup complete: External service mocks enabled for all tests');
}

export default globalSetup;
