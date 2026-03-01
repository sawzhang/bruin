/**
 * Editor empty state and trash-view editor behavior
 */
import { test, expect } from '../fixtures';

test.describe('Editor Empty State', () => {
  test('editor shows empty state when no note is selected', async ({ app }) => {
    await app.seed([{ title: 'Some Note' }]);
    await app.goto();

    // No note clicked yet — empty state should be visible, panel should not
    await expect(app.editorEmptyState).toBeVisible();
    await expect(app.editorPanel).not.toBeVisible();
  });

  test('empty state disappears once a note is selected', async ({ app }) => {
    await app.seed([{ title: 'Click Me' }]);
    await app.goto();

    await app.noteItem('Click Me').click();

    await expect(app.editorEmptyState).not.toBeVisible();
    await expect(app.editorPanel).toBeVisible();
  });

  test('clicking "Create your first note" from empty state opens editor', async ({ app }) => {
    await app.goto();

    // Empty state action button creates a note
    await app.page.getByRole('button', { name: /create your first note/i }).click();

    await expect(app.editorPanel).toBeVisible();
    await expect(app.editorTitle).toBeVisible();
  });

  test('trash-view note shows "In Trash" badge in editor', async ({ app }) => {
    await app.seed([{ title: 'Trash Badge Note' }]);
    await app.goto();

    // Trash via context menu
    await app.openNoteContextMenu('Trash Badge Note');
    await app.clickContextMenuItem('Move to Trash');

    // Open trash, click note
    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Trash Badge Note' }).click();

    await expect(app.editorPanel.getByText('In Trash', { exact: true })).toBeVisible();
  });

  test('editor title is read-only when viewing a trashed note', async ({ app }) => {
    await app.seed([{ title: 'Read Only Title' }]);
    await app.goto();

    await app.openNoteContextMenu('Read Only Title');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Read Only Title' }).click();

    await expect(app.editorTitle).toHaveAttribute('readonly');
  });

  test('state transition buttons are hidden in trash view', async ({ app }) => {
    await app.seed([{ title: 'Trash State Note', state: 'draft' }]);
    await app.goto();

    await app.openNoteContextMenu('Trash State Note');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Trash State Note' }).click();

    await expect(app.page.getByTestId('btn-state-review')).not.toBeVisible();
  });
});
