/**
 * Slash command extra block tests: spec 42 covers Heading 1, Heading 2,
 * Bullet List, Code Block, and Table. Four commands defined in SlashCommand.ts
 * are never tested: Heading 3, Numbered List, Blockquote, and Divider.
 * Complements spec 42 (slash commands).
 */
import { test, expect } from '../fixtures';

async function openNoteEditor(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Slash Extra Note' }]);
  await app.goto();
  await app.noteItem('Slash Extra Note').click();
  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  return editor;
}

test.describe('Slash Command Extra Blocks', () => {
  test('typing "/" shows "Heading 3" option', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    await expect(app.page.getByRole('button', { name: 'Heading 3' })).toBeVisible();
  });

  test('selecting "Heading 3" inserts an h3 block', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Heading 3' }).click();

    await expect(editor.locator('h3')).toBeVisible();
  });

  test('typing "/" shows "Numbered List" option', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    await expect(app.page.getByRole('button', { name: 'Numbered List' })).toBeVisible();
  });

  test('selecting "Numbered List" inserts an ol element', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Numbered List' }).click();

    await expect(editor.locator('ol')).toBeVisible();
  });

  test('typing "/" shows "Blockquote" option', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    await expect(app.page.getByRole('button', { name: 'Blockquote' })).toBeVisible();
  });

  test('selecting "Blockquote" inserts a blockquote element', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Blockquote' }).click();

    await expect(editor.locator('blockquote')).toBeVisible();
  });

  test('typing "/" shows "Divider" option', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');

    await expect(app.page.getByRole('button', { name: 'Divider' })).toBeVisible();
  });

  test('selecting "Divider" inserts an hr element', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/');
    await app.page.getByRole('button', { name: 'Divider' }).click();

    await expect(editor.locator('hr')).toBeVisible();
  });

  test('typing "/list" filters to show both Bullet List and Numbered List', async ({ app }) => {
    const editor = await openNoteEditor(app);
    await app.page.keyboard.type('/list');

    await expect(app.page.getByRole('button', { name: 'Bullet List' })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Numbered List' })).toBeVisible();
    // Non-matching commands should not appear
    await expect(app.page.getByRole('button', { name: 'Heading 1' })).not.toBeVisible();
  });
});
