/**
 * Command palette command execution tests
 * Covers: executing Settings, Change Theme, Knowledge Graph, Activity Feed,
 *         and Trash Note commands from the palette
 */
import { test, expect } from '../fixtures';

test.describe('Command Palette Execute', () => {
  async function openCommands(app: import('../page-objects/AppPage').AppPage) {
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
  }

  test('executing "Settings" command opens the settings panel', async ({ app }) => {
    await app.goto();

    await openCommands(app);
    await app.page.getByTestId('command-item').filter({ hasText: 'Settings' }).click();

    await expect(app.page.getByTestId('settings-panel')).toBeVisible();
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('executing "Change Theme" command opens the theme picker', async ({ app }) => {
    await app.goto();

    await openCommands(app);
    await app.page.getByTestId('command-item').filter({ hasText: 'Change Theme' }).click();

    await expect(app.page.getByTestId('theme-picker')).toBeVisible();
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('executing "Knowledge Graph" command opens graph view', async ({ app }) => {
    await app.goto();

    await openCommands(app);
    await app.page.getByTestId('command-item').filter({ hasText: 'Knowledge Graph' }).click();

    await expect(app.page.getByTestId('graph-view')).toBeVisible();
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('executing "Activity Feed" command opens activity panel', async ({ app }) => {
    await app.goto();

    await openCommands(app);
    await app.page.getByTestId('command-item').filter({ hasText: 'Activity Feed' }).click();

    await expect(app.page.getByTestId('activity-panel')).toBeVisible();
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
  });

  test('"Trash Note" command is visible only when a note is selected', async ({ app }) => {
    await app.seed([{ title: 'Context Note' }]);
    await app.goto();

    // Without a note selected, Trash Note command should not appear
    await openCommands(app);
    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Trash Note' })
    ).not.toBeVisible();
    await app.page.keyboard.press('Escape');

    // Select a note
    await app.noteItem('Context Note').click();

    // Now Trash Note command should appear
    await openCommands(app);
    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Trash Note' })
    ).toBeVisible();
  });

  test('executing "Trash Note" command trashes the selected note', async ({ app }) => {
    await app.seed([{ title: 'Trash via Palette' }]);
    await app.goto();

    await app.noteItem('Trash via Palette').click();

    await openCommands(app);
    await app.page.getByTestId('command-item').filter({ hasText: 'Trash Note' }).click();

    // Palette closes and note is removed from main list
    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
    await expect(app.noteItem('Trash via Palette')).not.toBeVisible();
  });
});
