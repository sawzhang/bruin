/**
 * NoteList empty-state tests for All Notes context: "No notes" text, visibility,
 * and absence of trash-specific copy.
 * Complements spec 67 (tests "Trash is empty" and workspace-filter "No notes")
 * — neither tests the All Notes empty state specifically or absence of trash copy.
 */
import { test, expect } from '../fixtures';

test.describe('Note List Empty — All Notes', () => {
  test('note-list-empty is visible in All Notes when no notes exist', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-empty')).toBeVisible();
  });

  test('note-list-empty shows "No notes" in All Notes when empty', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-empty')).toContainText('No notes');
  });

  test('note-list-empty does not show "Trash is empty" in All Notes', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-empty')).not.toContainText('Trash is empty');
  });

  test('note-list-empty does not show "Deleted notes will appear here" in All Notes', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-empty')).not.toContainText(
      'Deleted notes will appear here',
    );
  });

  test('note-list-empty is not visible when notes exist', async ({ app }) => {
    await app.seed([{ title: 'Has A Note' }]);
    await app.goto();

    await expect(app.page.getByTestId('note-list-empty')).not.toBeVisible();
  });

  test('note-list-empty appears after the only note is deleted', async ({ app }) => {
    await app.seed([{ title: 'Will Be Trashed' }]);
    await app.goto();

    await expect(app.page.getByTestId('note-list-empty')).not.toBeVisible();

    await app.openNoteContextMenu('Will Be Trashed');
    await app.clickContextMenuItem('Move to Trash');
    await app.confirmDialog();

    await expect(app.page.getByTestId('note-list-empty')).toBeVisible();
    await expect(app.page.getByTestId('note-list-empty')).toContainText('No notes');
  });

  test('note-list-empty is not visible in All Notes after adding a note', async ({ app }) => {
    await app.goto();
    await expect(app.page.getByTestId('note-list-empty')).toBeVisible();

    await app.createNote('New Entry');

    await expect(app.page.getByTestId('note-list-empty')).not.toBeVisible();
  });
});
