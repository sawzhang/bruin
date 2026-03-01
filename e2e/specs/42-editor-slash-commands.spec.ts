/**
 * Editor slash command menu tests: typing "/" triggers the command menu,
 * filtering works, and selecting a command inserts the correct block.
 */
import { test, expect } from '../fixtures';

async function openNoteEditor(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Slash Note' }]);
  await app.goto();
  await app.noteItem('Slash Note').click();
  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  return editor;
}

test.describe('Editor Slash Commands', () => {
  test('typing "/" opens the slash command menu', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    // The slash command menu should appear with some commands
    await expect(app.page.getByRole('button', { name: 'Heading 1' })).toBeVisible();
  });

  test('slash menu lists expected commands', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    await expect(app.page.getByRole('button', { name: 'Heading 1' })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Bullet List' })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Code Block' })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Table' })).toBeVisible();
  });

  test('typing after "/" filters commands', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/heading');

    await expect(app.page.getByRole('button', { name: 'Heading 1' })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Heading 2' })).toBeVisible();
    // Non-matching commands should not be visible
    await expect(app.page.getByRole('button', { name: 'Bullet List' })).not.toBeVisible();
  });

  test('selecting "Heading 1" inserts an h1 block', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Heading 1' }).click();

    await expect(editor.locator('h1')).toBeVisible();
  });

  test('selecting "Heading 2" inserts an h2 block', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Heading 2' }).click();

    await expect(editor.locator('h2')).toBeVisible();
  });

  test('selecting "Bullet List" inserts a ul', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Bullet List' }).click();

    await expect(editor.locator('ul')).toBeVisible();
  });

  test('selecting "Code Block" inserts a pre block', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Code Block' }).click();

    await expect(editor.locator('pre')).toBeVisible();
  });

  test('selecting "Table" inserts a table', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Table' }).click();

    await expect(editor.locator('table')).toBeVisible();
  });

  test('Escape closes the slash menu without inserting', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await expect(app.page.getByRole('button', { name: 'Heading 1' })).toBeVisible();

    await app.page.keyboard.press('Escape');

    await expect(app.page.getByRole('button', { name: 'Heading 1' })).not.toBeVisible();
    // No heading or list should have been inserted
    await expect(editor.locator('h1')).not.toBeVisible();
  });

  test('table bubble menu controls appear when cursor is inside a table', async ({ app }) => {
    const editor = await openNoteEditor(app);

    // Insert a table via slash command
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Table' }).click();

    // Click inside the table to position cursor
    await editor.locator('td').first().click();

    // Table controls appear in the bubble menu
    await expect(app.page.getByRole('button', { name: '+Row', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: '+Col', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Del', exact: true })).toBeVisible();
  });
});
