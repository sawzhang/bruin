/**
 * Tag rename and delete dialog detail tests: Cancel button, backdrop dismiss,
 * input pre-fill, and delete confirm message content (note count).
 * Complements spec 07 (tag ops: rename/delete flow) which covers Enter key
 * and Escape key but not Cancel button or confirm message content.
 */
import { test, expect } from '../fixtures';

test.describe('Tag Dialog Detail', () => {
  test('rename dialog input is pre-filled with the current tag name', async ({ app }) => {
    await app.seed([{ title: 'Pre-fill Note', tags: ['prefill-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'prefill-tag' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' }).click();

    await expect(app.page.getByTestId('rename-input')).toHaveValue('prefill-tag');
  });

  test('Cancel button in rename dialog closes dialog without renaming', async ({ app }) => {
    await app.seed([{ title: 'Cancel Rename Note', tags: ['cancel-me'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'cancel-me' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' }).click();

    await app.page.getByTestId('rename-input').fill('renamed-tag');
    // Click Cancel instead of Rename
    await app.page.getByTestId('rename-dialog').getByRole('button', { name: 'Cancel' }).click();

    // Dialog should close
    await expect(app.page.getByTestId('rename-dialog')).not.toBeVisible();
    // Original tag still in tree
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'cancel-me' })).toBeVisible();
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'renamed-tag' })).not.toBeVisible();
  });

  test('clicking backdrop of rename dialog closes it without renaming', async ({ app }) => {
    await app.seed([{ title: 'Backdrop Cancel Note', tags: ['backdrop-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'backdrop-tag' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Rename Tag' }).click();
    await expect(app.page.getByTestId('rename-dialog')).toBeVisible();

    // Click the backdrop overlay (top-left corner, outside the dialog box)
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByTestId('rename-dialog')).not.toBeVisible();
    // Tag unchanged
    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'backdrop-tag' })).toBeVisible();
  });

  test('delete confirm dialog title is "Delete Tag?"', async ({ app }) => {
    await app.seed([{ title: 'Delete Title Note', tags: ['del-title-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'del-title-tag' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' }).click();

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('Delete Tag?');
  });

  test('delete confirm message says "1 note" when one note has the tag', async ({ app }) => {
    await app.seed([{ title: 'Single Tag Note', tags: ['one-note-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'one-note-tag' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' }).click();

    // Singular form: "1 note"
    await expect(app.page.getByTestId('confirm-dialog')).toContainText('1 note');
    await expect(app.page.getByTestId('confirm-dialog')).not.toContainText('1 notes');
  });

  test('delete confirm message says "2 notes" when two notes have the tag', async ({ app }) => {
    await app.seed([
      { title: 'Tag Note One', tags: ['two-notes-tag'] },
      { title: 'Tag Note Two', tags: ['two-notes-tag'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'two-notes-tag' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' }).click();

    // Plural form: "2 notes"
    await expect(app.page.getByTestId('confirm-dialog')).toContainText('2 notes');
  });

  test('Cancel on delete confirm dialog keeps the tag in the tree', async ({ app }) => {
    await app.seed([{ title: 'Keep Tag Note', tags: ['keep-this-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'keep-this-tag' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' }).click();
    await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();

    await app.cancelDialog();

    await expect(app.tagTree.getByTestId('tag-item').filter({ hasText: 'keep-this-tag' })).toBeVisible();
  });

  test('delete confirm message mentions "Notes themselves will not be deleted"', async ({ app }) => {
    await app.seed([{ title: 'Notes Intact Note', tags: ['notes-intact-tag'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'notes-intact-tag' }).click({ button: 'right' });
    await app.page.getByTestId('context-menu-item').filter({ hasText: 'Delete Tag' }).click();

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('Notes themselves will not be deleted');
  });
});
