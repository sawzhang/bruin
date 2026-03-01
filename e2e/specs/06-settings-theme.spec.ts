/**
 * Settings panel and theme switcher tests
 */
import { test, expect } from '../fixtures';

test.describe('Settings & Themes', () => {
  test.describe('Settings panel', () => {
    test('clicking settings button opens settings panel', async ({ app }) => {
      await app.goto();

      await app.btnSettings.click();

      await expect(app.page.getByTestId('settings-panel')).toBeVisible();
    });

    test('settings panel can be dismissed by clicking backdrop', async ({ app }) => {
      await app.goto();
      await app.btnSettings.click();
      await expect(app.page.getByTestId('settings-panel')).toBeVisible();

      // Click the backdrop (fixed overlay behind the panel)
      await app.page.mouse.click(10, 10);

      await expect(app.page.getByTestId('settings-panel')).not.toBeVisible();
    });
  });

  test.describe('Theme picker', () => {
    test('clicking themes button opens theme picker', async ({ app }) => {
      await app.goto();

      await app.btnThemes.click();

      await expect(app.page.getByTestId('theme-picker')).toBeVisible();
    });

    test('theme picker lists multiple themes', async ({ app }) => {
      await app.goto();
      await app.btnThemes.click();

      // 6 themes: each button has data-testid="theme-option-{id}"
      const themeOptions = app.page.locator('[data-testid^="theme-option-"]');
      await expect(themeOptions).toHaveCount(6);
    });

    test('selecting a theme updates CSS variables', async ({ app }) => {
      await app.goto();

      const bgBefore = await app.page.evaluate(() =>
        getComputedStyle(document.querySelector('[data-testid="app-layout"]')!).getPropertyValue('--bear-bg').trim()
      );

      await app.btnThemes.click();
      // Click a theme that is different from default (dark-graphite)
      await app.page.getByTestId('theme-option-solarized-dark').click();

      const bgAfter = await app.page.evaluate(() =>
        getComputedStyle(document.querySelector('[data-testid="app-layout"]')!).getPropertyValue('--bear-bg').trim()
      );

      expect(bgAfter).not.toBe(bgBefore);
    });

    test('selected theme is reflected in app-layout class', async ({ app }) => {
      await app.goto();

      await app.btnThemes.click();
      await app.page.getByTestId('theme-option-solarized-dark').click();

      await expect(app.page.getByTestId('app-layout')).toHaveClass(/theme-solarized-dark/);
    });
  });
});
