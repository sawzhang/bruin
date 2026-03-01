/**
 * Settings panel extra tests: × close button, section headings, spell-check and
 * line-numbers toggles, manage-webhooks shortcut, defaults section.
 */
import { test, expect } from '../fixtures';

test.describe('Settings Extra', () => {
  async function openSettings(app: import('../page-objects/AppPage').AppPage) {
    await app.btnSettings.click();
    await expect(app.page.getByTestId('settings-panel')).toBeVisible();
  }

  test('settings panel closes when clicking the × button', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    // The × close button is inside the panel header
    const panel = app.page.getByTestId('settings-panel');
    await panel.getByRole('button', { name: '×' }).click();

    await expect(panel).not.toBeVisible();
  });

  test('settings panel shows "Appearance" section heading', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    await expect(app.page.getByTestId('settings-panel').getByText('Appearance')).toBeVisible();
  });

  test('settings panel shows "Editor" section heading', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    await expect(app.page.getByTestId('settings-panel').getByText('Editor')).toBeVisible();
  });

  test('settings panel shows "Integrations" section with "Manage Webhooks" link', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    await expect(app.page.getByTestId('btn-manage-webhooks')).toBeVisible();
    await expect(app.page.getByTestId('btn-manage-webhooks')).toHaveText('Manage Webhooks');
  });

  test('"Manage Webhooks" closes settings and opens webhook manager', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    await app.page.getByTestId('btn-manage-webhooks').click();

    await expect(app.page.getByTestId('settings-panel')).not.toBeVisible();
    await expect(app.page.getByTestId('webhook-manager')).toBeVisible();
  });

  test('settings panel shows "Defaults" section with default workspace select', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const panel = app.page.getByTestId('settings-panel');
    await expect(panel.getByText('Defaults')).toBeVisible();
    await expect(panel.getByText('Default Workspace')).toBeVisible();
  });

  test('Spell Check toggle button is visible in the settings panel', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    // The Spell Check label and its adjacent toggle button
    const panel = app.page.getByTestId('settings-panel');
    await expect(panel.getByText('Spell Check')).toBeVisible();

    // The toggle button is the button sibling of the Spell Check label
    const spellCheckToggle = panel
      .getByText('Spell Check')
      .locator('xpath=..')
      .locator('button');
    await expect(spellCheckToggle).toBeVisible();
  });

  test('Line Numbers toggle button is visible in the settings panel', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const panel = app.page.getByTestId('settings-panel');
    await expect(panel.getByText('Line Numbers')).toBeVisible();

    const lineNumbersToggle = panel
      .getByText('Line Numbers')
      .locator('xpath=..')
      .locator('button');
    await expect(lineNumbersToggle).toBeVisible();
  });

  test('clicking Spell Check toggle changes its visual state', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const panel = app.page.getByTestId('settings-panel');
    const toggle = panel
      .getByText('Spell Check')
      .locator('xpath=..')
      .locator('button');

    // Record initial class (bg-bear-accent = on, bg-bear-hover = off)
    const classBefore = await toggle.getAttribute('class');

    await toggle.click();

    const classAfter = await toggle.getAttribute('class');
    // Class should change (toggle switched)
    expect(classAfter).not.toBe(classBefore);
  });

  test('font size display updates when the slider is moved', async ({ app }) => {
    await app.goto();
    await openSettings(app);

    const panel = app.page.getByTestId('settings-panel');
    const slider = panel.locator('input[type="range"]');
    await expect(slider).toBeVisible();

    // The current fontSize is displayed next to the slider
    const fontSizeDisplay = panel.locator('span.w-8');
    const initialValue = await fontSizeDisplay.textContent();

    // Move slider to max (24)
    await slider.fill('24');

    const newValue = await fontSizeDisplay.textContent();
    expect(newValue).toBe('24');
    expect(newValue).not.toBe(initialValue);
  });
});
