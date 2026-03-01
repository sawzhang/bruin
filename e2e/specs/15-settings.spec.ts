/**
 * Settings panel tests: open, font family, auto-save, persistence
 */
import { test, expect } from '../fixtures';

test.describe('Settings', () => {
  test('clicking btn-settings opens the settings panel', async ({ app }) => {
    await app.goto();

    await app.btnSettings.click();

    await expect(app.page.getByTestId('settings-panel')).toBeVisible();
  });

  test('settings panel closes when clicking the backdrop', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();
    await expect(app.page.getByTestId('settings-panel')).toBeVisible();

    // Click outside the panel
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('settings-panel')).not.toBeVisible();
  });

  test('font family select has default value "system-ui"', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await expect(app.page.getByTestId('settings-font-family')).toHaveValue('system-ui');
  });

  test('changing font family updates the select value', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await app.page.getByTestId('settings-font-family').selectOption('Georgia, serif');

    await expect(app.page.getByTestId('settings-font-family')).toHaveValue('Georgia, serif');
  });

  test('auto-save interval select has default value "1000"', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await expect(app.page.getByTestId('settings-auto-save')).toHaveValue('1000');
  });

  test('changing auto-save interval updates the select value', async ({ app }) => {
    await app.goto();
    await app.btnSettings.click();

    await app.page.getByTestId('settings-auto-save').selectOption('2000');

    await expect(app.page.getByTestId('settings-auto-save')).toHaveValue('2000');
  });

  test('pre-seeded font family setting is reflected in the panel', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.settings['fontFamily'] = 'Georgia, serif';
    });
    await app.goto();
    await app.btnSettings.click();

    await expect(app.page.getByTestId('settings-font-family')).toHaveValue('Georgia, serif');
  });

  test('pre-seeded auto-save setting is reflected in the panel', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.settings['autoSaveInterval'] = '5000';
    });
    await app.goto();
    await app.btnSettings.click();

    await expect(app.page.getByTestId('settings-auto-save')).toHaveValue('5000');
  });
});
