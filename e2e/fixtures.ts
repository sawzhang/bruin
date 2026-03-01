/**
 * Playwright custom fixtures.
 *
 * Every test that imports { test, expect } from this file automatically gets:
 *   1. The Tauri IPC mock injected before the page loads
 *   2. An `AppPage` instance ready to use
 */
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { test as base, expect } from '@playwright/test';
import { AppPage } from './page-objects/AppPage.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const mockPath = join(__dirname, 'setup/tauri-mock.js');

export { expect };

export const test = base.extend<{ app: AppPage }>({
  // Wrap the built-in `page` fixture to inject the mock init script
  page: async ({ page }, use) => {
    await page.addInitScript({ path: mockPath });
    await use(page);
  },

  // Provide a pre-constructed AppPage for every test
  app: async ({ page }, use) => {
    await page.addInitScript({ path: mockPath });
    const app = new AppPage(page);
    await use(app);
  },
});
