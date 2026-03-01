/**
 * Command palette additional command tests: input placeholder, commands visible
 * on empty query, Tasks/Agent Dashboard commands, Export commands (note-gated),
 * and data-command-id attributes.
 * Complements spec 18 (search mode) and spec 38 (execute: Settings/Theme/Graph/Activity).
 */
import { test, expect } from '../fixtures';

async function openEmpty(app: import('../page-objects/AppPage').AppPage) {
  await app.openCommandPalette();
  // Do NOT type anything — query is empty
}

async function openCommands(app: import('../page-objects/AppPage').AppPage) {
  await app.openCommandPalette();
  await app.page.getByTestId('command-palette-input').fill('>');
}

test.describe('Command Palette Commands Extra', () => {
  test('command palette input has the correct placeholder text', async ({ app }) => {
    await app.goto();
    await openEmpty(app);

    await expect(app.page.getByTestId('command-palette-input')).toHaveAttribute(
      'placeholder',
      'Search notes... (type > for commands)',
    );
  });

  test('commands are visible when query is empty (no > prefix needed)', async ({ app }) => {
    await app.goto();
    await openEmpty(app);

    // The "New Note" command should be visible even without the > prefix
    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'New Note' }),
    ).toBeVisible();
  });

  test('"Tasks" command is visible in the command list', async ({ app }) => {
    await app.goto();
    await openCommands(app);

    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Tasks' }),
    ).toBeVisible();
  });

  test('executing "Tasks" command opens the task panel and closes the palette', async ({ app }) => {
    await app.goto();
    await openCommands(app);
    await app.page.getByTestId('command-item').filter({ hasText: 'Tasks' }).click();

    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
    await expect(app.page.getByTestId('task-panel')).toBeVisible();
  });

  test('"Agent Dashboard" command is visible in the command list', async ({ app }) => {
    await app.goto();
    await openCommands(app);

    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Agent Dashboard' }),
    ).toBeVisible();
  });

  test('executing "Agent Dashboard" command opens the agent dashboard', async ({ app }) => {
    await app.goto();
    await openCommands(app);
    await app.page.getByTestId('command-item').filter({ hasText: 'Agent Dashboard' }).click();

    await expect(app.page.getByTestId('command-palette')).not.toBeVisible();
    await expect(app.page.getByTestId('agent-dashboard')).toBeVisible();
  });

  test('"Export as Markdown" command appears only when a note is selected', async ({ app }) => {
    await app.seed([{ title: 'Export Target' }]);
    await app.goto();

    // Without a note selected
    await openCommands(app);
    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Export as Markdown' }),
    ).not.toBeVisible();
    await app.page.keyboard.press('Escape');

    // Select a note
    await app.noteItem('Export Target').click();

    await openCommands(app);
    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Export as Markdown' }),
    ).toBeVisible();
  });

  test('"Export as HTML" command appears only when a note is selected', async ({ app }) => {
    await app.seed([{ title: 'HTML Export Target' }]);
    await app.goto();

    // Without a note selected
    await openCommands(app);
    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Export as HTML' }),
    ).not.toBeVisible();
    await app.page.keyboard.press('Escape');

    // Select a note
    await app.noteItem('HTML Export Target').click();

    await openCommands(app);
    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Export as HTML' }),
    ).toBeVisible();
  });

  test('"new-note" command item has data-command-id="new-note"', async ({ app }) => {
    await app.goto();
    await openCommands(app);

    const newNoteItem = app.page.getByTestId('command-item').filter({ hasText: 'New Note' });
    await expect(newNoteItem).toHaveAttribute('data-command-id', 'new-note');
  });

  test('"settings" command item has data-command-id="settings"', async ({ app }) => {
    await app.goto();
    await openCommands(app);

    const settingsItem = app.page.getByTestId('command-item').filter({ hasText: 'Settings' });
    await expect(settingsItem).toHaveAttribute('data-command-id', 'settings');
  });

  test('typing ">tasks" filters to only Tasks command', async ({ app }) => {
    await app.goto();
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>tasks');

    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'Tasks' }),
    ).toBeVisible();
    await expect(
      app.page.getByTestId('command-item').filter({ hasText: 'New Note' }),
    ).not.toBeVisible();
  });
});
