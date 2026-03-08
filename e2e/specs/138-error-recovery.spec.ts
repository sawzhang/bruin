/**
 * Error recovery and empty state transition tests: verifies the app handles
 * edge cases gracefully — empty DB shows correct empty states, creating a note
 * transitions away from empty state, trashing the last note brings empty state
 * back, and restoring from trash recovers the note.
 */
import { test, expect } from '../fixtures';

test.describe('Error Recovery', () => {
  test('app loads with empty DB showing both empty states', async ({ app }) => {
    await app.goto();

    await expect(app.noteListEmpty).toBeVisible();
    await expect(app.editorEmptyState).toBeVisible();
    await expect(app.editorPanel).not.toBeVisible();
  });

  test('creating a note transitions from empty state to showing note', async ({ app }) => {
    await app.goto();

    // Verify empty state is showing
    await expect(app.noteListEmpty).toBeVisible();
    await expect(app.editorEmptyState).toBeVisible();

    // Create a note
    await app.createNote('First Note');

    // Empty states should be gone
    await expect(app.noteListEmpty).not.toBeVisible();
    await expect(app.editorEmptyState).not.toBeVisible();
    await expect(app.editorPanel).toBeVisible();
    await expect(app.noteItem('First Note')).toBeVisible();
  });

  test('trashing the last note shows empty state in note list', async ({ app }) => {
    await app.seed([{ title: 'Last Standing' }]);
    await app.goto();

    await expect(app.noteListEmpty).not.toBeVisible();

    await app.openNoteContextMenu('Last Standing');
    await app.clickContextMenuItem('Move to Trash');

    await expect(app.noteListEmpty).toBeVisible();
    await expect(app.noteItem('Last Standing')).not.toBeVisible();
  });

  test('restoring a note from trash makes it reappear in All Notes', async ({ app }) => {
    await app.seed([{ title: 'Recoverable Note', content: 'important data' }]);
    await app.goto();

    // Trash the note
    await app.openNoteContextMenu('Recoverable Note');
    await app.clickContextMenuItem('Move to Trash');
    await expect(app.noteListEmpty).toBeVisible();

    // Navigate to trash and restore
    await app.navTrash.click();
    await expect(app.noteItem('Recoverable Note')).toBeVisible();
    await app.noteItem('Recoverable Note').click();
    await app.page.getByTestId('btn-restore').click();

    // Navigate back to All Notes
    await app.navAllNotes.click();
    await expect(app.noteItem('Recoverable Note')).toBeVisible();
    await expect(app.noteListEmpty).not.toBeVisible();
  });
});
