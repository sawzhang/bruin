/**
 * Settings select option label tests: verifies the display text of each
 * <option> in the font-family and auto-save selectors.
 * Complements spec 15 (tests option values) and spec 46 (tests section headings).
 */
import { test, expect } from '../fixtures';

async function openSettings(app: import('../page-objects/AppPage').AppPage) {
  await app.btnSettings.click();
  await expect(app.page.getByTestId('settings-panel')).toBeVisible();
}

test.describe('Settings Select Option Labels', () => {
  test('font-family select has exactly 4 options with correct labels', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    // <option> elements are hidden inside a closed <select>, so use toHaveText array
    await expect(app.page.getByTestId('settings-font-family').locator('option')).toHaveText([
      'System Default',
      'Inter',
      'Georgia',
      'SF Mono',
    ]);
  });

  test('font-family first option is "System Default" (value="system-ui")', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const select = app.page.getByTestId('settings-font-family');
    await expect(select.locator('option').nth(0)).toHaveText('System Default');
    await expect(select.locator('option').nth(0)).toHaveAttribute('value', 'system-ui');
  });

  test('auto-save select has "500ms" option', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const select = app.page.getByTestId('settings-auto-save');
    await expect(select.locator('option[value="500"]')).toHaveText('500ms');
  });

  test('auto-save select has "1 second" option', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const select = app.page.getByTestId('settings-auto-save');
    await expect(select.locator('option[value="1000"]')).toHaveText('1 second');
  });

  test('auto-save select has "2 seconds" option', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const select = app.page.getByTestId('settings-auto-save');
    await expect(select.locator('option[value="2000"]')).toHaveText('2 seconds');
  });

  test('auto-save select has "5 seconds" option', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const select = app.page.getByTestId('settings-auto-save');
    await expect(select.locator('option[value="5000"]')).toHaveText('5 seconds');
  });

  test('auto-save select has exactly 4 options', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    await expect(app.page.getByTestId('settings-auto-save').locator('option')).toHaveCount(4);
  });
});
