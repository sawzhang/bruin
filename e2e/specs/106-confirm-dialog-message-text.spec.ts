/**
 * ConfirmDialog message text tests: dialogs rendered by EditorPanel embed the
 * note title in their message and include descriptive copy. Spec 81 (detail) and
 * spec 27 (cancel paths) cover button testids, labels, Escape, and bg-red-600 —
 * but no spec ever asserts the dialog *title heading* or *message body text*.
 * Complements spec 81 (ConfirmDialog detail).
 */
import { test, expect } from '../fixtures';

test.describe('Confirm Dialog Message Text', () => {
  test('"Move to Trash" dialog title heading is "Move to Trash?"', async ({ app }) => {
    await app.seed([{ title: 'Heading Check Note' }]);
    await app.goto();
    await app.noteItem('Heading Check Note').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();

    // The <h3> in the dialog shows the title prop
    await expect(app.page.getByTestId('confirm-dialog')).toContainText('Move to Trash?');
  });

  test('"Move to Trash" dialog message contains "will be moved to trash"', async ({ app }) => {
    await app.seed([{ title: 'Move Message Note' }]);
    await app.goto();
    await app.noteItem('Move Message Note').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('will be moved to trash');
  });

  test('"Move to Trash" dialog message contains "You can restore it later"', async ({ app }) => {
    await app.seed([{ title: 'Restore Later Note' }]);
    await app.goto();
    await app.noteItem('Restore Later Note').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('You can restore it later');
  });

  test('"Move to Trash" dialog message contains the note title in quotes', async ({ app }) => {
    await app.seed([{ title: 'Quoted Title Note' }]);
    await app.goto();
    await app.noteItem('Quoted Title Note').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('"Quoted Title Note"');
  });

  test('"Move to Trash" dialog shows "Untitled" in message when note has no title', async ({
    app,
  }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.notes.push({
        id: 'untitled-trash',
        title: '',
        content: '',
        state: 'draft',
        is_pinned: false,
        deleted: false,
        word_count: 0,
        tags: [],
        workspace_id: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        version: 1,
      });
    });
    await app.goto();
    await app.page.getByTestId('note-item').filter({ hasText: 'Untitled' }).click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();

    // Untitled fallback: "Untitled" will be moved to trash
    await expect(app.page.getByTestId('confirm-dialog')).toContainText('"Untitled"');
  });

  test('"Delete Permanently" dialog message contains "will be permanently deleted"', async ({
    app,
  }) => {
    await app.seed([{ title: 'Perm Delete Message Note' }]);
    await app.goto();

    // Move to trash first
    await app.openNoteContextMenu('Perm Delete Message Note');
    await app.clickContextMenuItem('Move to Trash');
    await app.confirmDialog();

    // Navigate to trash and open the note
    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Perm Delete Message Note' }).click();
    await app.page.getByTestId('btn-delete-permanent').click();

    await expect(app.page.getByTestId('confirm-dialog')).toContainText(
      'will be permanently deleted',
    );
  });

  test('"Delete Permanently" dialog message contains the note title in quotes', async ({
    app,
  }) => {
    await app.seed([{ title: 'Perm Delete Title Note' }]);
    await app.goto();

    await app.openNoteContextMenu('Perm Delete Title Note');
    await app.clickContextMenuItem('Move to Trash');
    await app.confirmDialog();

    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Perm Delete Title Note' }).click();
    await app.page.getByTestId('btn-delete-permanent').click();

    await expect(app.page.getByTestId('confirm-dialog')).toContainText('"Perm Delete Title Note"');
  });
});
