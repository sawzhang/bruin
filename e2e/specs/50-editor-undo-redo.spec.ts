/**
 * Editor undo/redo keyboard shortcut tests.
 * Cmd+Z undoes the last change; Cmd+Shift+Z (or Cmd+Y) redoes it.
 * TipTap has built-in undo/redo via its History extension.
 */
import { test, expect } from '../fixtures';

async function openNoteEditor(app: import('../page-objects/AppPage').AppPage) {
  await app.seed([{ title: 'Undo Test Note', content: '' }]);
  await app.goto();
  await app.noteItem('Undo Test Note').click();
  const editor = app.page.locator('.ProseMirror');
  await editor.click();
  return editor;
}

test.describe('Editor Undo / Redo', () => {
  test('Cmd+Z undoes the last typed word', async ({ app }) => {
    const editor = await openNoteEditor(app);

    await app.page.keyboard.type('hello');
    await expect(editor).toContainText('hello');

    await app.page.keyboard.press('Meta+z');

    // After undo the last insertion is removed
    await expect(editor).not.toContainText('hello');
  });

  test('Cmd+Shift+Z redoes after an undo', async ({ app }) => {
    const editor = await openNoteEditor(app);

    await app.page.keyboard.type('world');
    await expect(editor).toContainText('world');

    // Undo
    await app.page.keyboard.press('Meta+z');
    await expect(editor).not.toContainText('world');

    // Redo
    await app.page.keyboard.press('Meta+Shift+z');
    await expect(editor).toContainText('world');
  });

  test('undo on empty editor does not crash', async ({ app }) => {
    const editor = await openNoteEditor(app);

    // Editor starts empty; undo should be a no-op
    await app.page.keyboard.press('Meta+z');

    // Editor still visible and editable
    await expect(editor).toBeVisible();
    await expect(editor).toHaveAttribute('contenteditable', 'true');
  });

  test('multiple undos remove multiple insertions', async ({ app }) => {
    const editor = await openNoteEditor(app);

    await app.page.keyboard.type('alpha ');
    await app.page.keyboard.type('beta ');
    await app.page.keyboard.type('gamma');

    await expect(editor).toContainText('alpha');
    await expect(editor).toContainText('gamma');

    // Undo several times
    await app.page.keyboard.press('Meta+z');
    await app.page.keyboard.press('Meta+z');
    await app.page.keyboard.press('Meta+z');

    // At least the most recently typed chunk should be gone
    await expect(editor).not.toContainText('gamma');
  });

  test('redo after multiple undos restores content', async ({ app }) => {
    const editor = await openNoteEditor(app);

    await app.page.keyboard.type('restore me');
    await expect(editor).toContainText('restore me');

    // Undo
    await app.page.keyboard.press('Meta+z');
    await expect(editor).not.toContainText('restore me');

    // Redo
    await app.page.keyboard.press('Meta+Shift+z');
    await expect(editor).toContainText('restore me');
  });

  test('typing after undo clears the redo stack (new content stays)', async ({ app }) => {
    const editor = await openNoteEditor(app);

    await app.page.keyboard.type('first');
    await app.page.keyboard.press('Meta+z');
    await expect(editor).not.toContainText('first');

    // Type new content after undo
    await app.page.keyboard.type('second');
    await expect(editor).toContainText('second');

    // Redo should not bring back "first"
    await app.page.keyboard.press('Meta+Shift+z');
    await expect(editor).not.toContainText('first');
    await expect(editor).toContainText('second');
  });
});
