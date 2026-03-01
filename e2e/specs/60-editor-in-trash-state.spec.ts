/**
 * Editor UI in trash state: "In Trash" badge, hidden state/pin/more/export buttons,
 * visible restore/delete-permanent buttons, and read-only title/content.
 * Tests the showTrash branch in EditorPanel.tsx.
 * Complements spec 17 (basic trash CRUD) and spec 59 (trash view extras).
 */
import { test, expect } from '../fixtures';

async function openTrashedNoteInEditor(
  app: import('../page-objects/AppPage').AppPage,
  title: string,
) {
  await app.openNoteContextMenu(title);
  await app.clickContextMenuItem('Move to Trash');
  await app.navTrash.click();
  await app.page.getByTestId('note-item').filter({ hasText: title }).click();
}

test.describe('Editor in Trash State', () => {
  test('"In Trash" badge is visible in the editor header for a trashed note', async ({ app }) => {
    await app.seed([{ title: 'Trashed Editor Note' }]);
    await app.goto();

    await openTrashedNoteInEditor(app, 'Trashed Editor Note');

    await expect(app.page.getByText('In Trash', { exact: true })).toBeVisible();
  });

  test('state transition buttons are hidden when editing a trashed note', async ({ app }) => {
    await app.seed([{ title: 'State Hidden Note' }]);
    await app.goto();

    await openTrashedNoteInEditor(app, 'State Hidden Note');

    await expect(app.page.getByTestId('btn-state-review')).not.toBeVisible();
    await expect(app.page.getByTestId('btn-state-published')).not.toBeVisible();
  });

  test('pin button is hidden when editing a trashed note', async ({ app }) => {
    await app.seed([{ title: 'Pin Hidden Note' }]);
    await app.goto();

    await openTrashedNoteInEditor(app, 'Pin Hidden Note');

    await expect(app.page.getByTestId('btn-pin')).not.toBeVisible();
  });

  test('more menu button is hidden when editing a trashed note', async ({ app }) => {
    await app.seed([{ title: 'More Hidden Note' }]);
    await app.goto();

    await openTrashedNoteInEditor(app, 'More Hidden Note');

    await expect(app.page.getByTestId('btn-more')).not.toBeVisible();
  });

  test('"Restore" button is visible in the editor for a trashed note', async ({ app }) => {
    await app.seed([{ title: 'Restore Visible Note' }]);
    await app.goto();

    await openTrashedNoteInEditor(app, 'Restore Visible Note');

    await expect(app.page.getByTestId('btn-restore')).toBeVisible();
  });

  test('"Delete Permanently" button is visible in the editor for a trashed note', async ({ app }) => {
    await app.seed([{ title: 'Delete Perm Visible Note' }]);
    await app.goto();

    await openTrashedNoteInEditor(app, 'Delete Perm Visible Note');

    await expect(app.page.getByTestId('btn-delete-permanent')).toBeVisible();
  });

  test('restoring a note from the editor toolbar returns note to All Notes', async ({ app }) => {
    await app.seed([{ title: 'Editor Restore Action' }]);
    await app.goto();

    await openTrashedNoteInEditor(app, 'Editor Restore Action');
    await app.page.getByTestId('btn-restore').click();

    // After restore, navigate to All Notes and verify the note is there (not in trash)
    await app.navAllNotes.click();
    await expect(app.noteItem('Editor Restore Action')).toBeVisible();
  });

  test('export button is hidden when editing a trashed note', async ({ app }) => {
    await app.seed([{ title: 'Export Hidden Note' }]);
    await app.goto();

    await openTrashedNoteInEditor(app, 'Export Hidden Note');

    await expect(app.page.getByTestId('btn-export')).not.toBeVisible();
  });
});
