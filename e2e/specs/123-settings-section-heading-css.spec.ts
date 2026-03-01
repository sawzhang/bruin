/**
 * SettingsPanel section heading CSS class tests: every <h3> in SettingsPanel.tsx
 * carries the same class string: "text-[12px] uppercase tracking-wider
 * text-bear-text-muted font-medium mb-3". No existing spec (15, 46, 55, 73)
 * ever calls toHaveClass() on these headings — they only interact with the
 * controls inside each section or assert panel visibility.
 * Complements spec 15 (settings panel) and spec 46 (settings persistence).
 */
import { test, expect } from '../fixtures';

async function openSettings(app: import('../page-objects/AppPage').AppPage) {
  await app.goto();
  await app.btnSettings.click();
  await expect(app.page.getByTestId('settings-panel')).toBeVisible();
}

test.describe('Settings Section Heading CSS', () => {
  test('"Appearance" heading has uppercase class', async ({ app }) => {
    await openSettings(app);

    await expect(
      app.page.getByTestId('settings-panel').locator('h3').filter({ hasText: 'Appearance' }),
    ).toHaveClass(/uppercase/);
  });

  test('"Appearance" heading has tracking-wider class', async ({ app }) => {
    await openSettings(app);

    await expect(
      app.page.getByTestId('settings-panel').locator('h3').filter({ hasText: 'Appearance' }),
    ).toHaveClass(/tracking-wider/);
  });

  test('"Editor" heading has uppercase and tracking-wider classes', async ({ app }) => {
    await openSettings(app);

    const heading = app.page
      .getByTestId('settings-panel')
      .locator('h3')
      .filter({ hasText: 'Editor' });
    await expect(heading).toHaveClass(/uppercase/);
    await expect(heading).toHaveClass(/tracking-wider/);
  });

  test('"Integrations" heading has uppercase class', async ({ app }) => {
    await openSettings(app);

    await expect(
      app.page.getByTestId('settings-panel').locator('h3').filter({ hasText: 'Integrations' }),
    ).toHaveClass(/uppercase/);
  });

  test('"Defaults" heading has uppercase and tracking-wider classes', async ({ app }) => {
    await openSettings(app);

    const heading = app.page
      .getByTestId('settings-panel')
      .locator('h3')
      .filter({ hasText: 'Defaults' });
    await expect(heading).toHaveClass(/uppercase/);
    await expect(heading).toHaveClass(/tracking-wider/);
  });

  test('all section headings have text-bear-text-muted class', async ({ app }) => {
    await openSettings(app);

    const headings = app.page.getByTestId('settings-panel').locator('h3');
    const count = await headings.count();
    for (let i = 0; i < count; i++) {
      await expect(headings.nth(i)).toHaveClass(/text-bear-text-muted/);
    }
  });

  test('all section headings have font-medium class', async ({ app }) => {
    await openSettings(app);

    const headings = app.page.getByTestId('settings-panel').locator('h3');
    const count = await headings.count();
    for (let i = 0; i < count; i++) {
      await expect(headings.nth(i)).toHaveClass(/font-medium/);
    }
  });
});
