/**
 * Theme picker UI detail tests: heading, subtitle, Escape/backdrop dismiss,
 * and selected-theme border styling.
 * Complements spec 06 which tests open, theme count, CSS variable change, and
 * app-layout class update — but not the picker's own text or close behaviors.
 */
import { test, expect } from '../fixtures';

test.describe('Theme Picker Detail', () => {
  test('theme picker shows "Themes" heading', async ({ app }) => {
    await app.goto();
    await app.btnThemes.click();

    await expect(
      app.page.getByTestId('theme-picker').getByText('Themes'),
    ).toBeVisible();
  });

  test('theme picker shows "Choose an appearance for Bruin" subtitle', async ({ app }) => {
    await app.goto();
    await app.btnThemes.click();

    await expect(
      app.page.getByTestId('theme-picker').getByText('Choose an appearance for Bruin'),
    ).toBeVisible();
  });

  test('pressing Escape closes the theme picker', async ({ app }) => {
    await app.goto();
    await app.btnThemes.click();
    await expect(app.page.getByTestId('theme-picker')).toBeVisible();

    await app.page.keyboard.press('Escape');

    await expect(app.page.getByTestId('theme-picker')).not.toBeVisible();
  });

  test('clicking the backdrop closes the theme picker', async ({ app }) => {
    await app.goto();
    await app.btnThemes.click();
    await expect(app.page.getByTestId('theme-picker')).toBeVisible();

    // Click top-left corner — outside the picker modal
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('theme-picker')).not.toBeVisible();
  });

  test('the currently active theme option has border-bear-accent class', async ({ app }) => {
    await app.goto();
    await app.btnThemes.click();

    // The default theme is dark-graphite; its button should have the accent border
    const activeOption = app.page.getByTestId('theme-option-dark-graphite');
    await expect(activeOption).toHaveClass(/border-bear-accent/);
  });

  test('a non-selected theme option does not have border-bear-accent class', async ({ app }) => {
    await app.goto();
    await app.btnThemes.click();

    // solarized-dark is not the default theme
    const inactiveOption = app.page.getByTestId('theme-option-solarized-dark');
    await expect(inactiveOption).not.toHaveClass(/border-bear-accent/);
  });

  test('selecting a theme makes its option gain border-bear-accent class', async ({ app }) => {
    await app.goto();
    await app.btnThemes.click();

    await app.page.getByTestId('theme-option-solarized-dark').click();

    // The picker stays open after theme selection, so check the class directly
    await expect(
      app.page.getByTestId('theme-option-solarized-dark'),
    ).toHaveClass(/border-bear-accent/);
  });

  test('each theme option shows a theme name label', async ({ app }) => {
    await app.goto();
    await app.btnThemes.click();

    // Every theme option button should contain some visible text (the theme name)
    const options = app.page.locator('[data-testid^="theme-option-"]');
    const count = await options.count();
    for (let i = 0; i < count; i++) {
      await expect(options.nth(i).locator('div.font-medium')).not.toBeEmpty();
    }
  });
});
