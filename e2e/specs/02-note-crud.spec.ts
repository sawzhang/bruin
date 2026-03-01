/**
 * Note CRUD operations
 * Covers create, read, update (title/content), delete, pin, trash & restore.
 */
import { test, expect } from '../fixtures';

test.describe('Note CRUD', () => {
  test('creates a new note via sidebar button', async ({ app }) => {
    await app.goto();

    await app.newNoteBtn.click();

    await expect(app.editorPanel).toBeVisible();
    await expect(app.editorTitle).toBeVisible();
    await expect(app.noteStateBadge).toContainText('Draft');
  });

  test('new note appears in list immediately after creation', async ({ app }) => {
    await app.goto();

    await app.createNote('My Fresh Note');

    await expect(app.noteItem('My Fresh Note')).toBeVisible();
  });

  test('clicking a seeded note opens it in the editor', async ({ app }) => {
    await app.seed([{ title: 'Clickable Note', content: 'Some content here' }]);
    await app.goto();

    await app.noteItem('Clickable Note').click();

    await expect(app.editorPanel).toBeVisible();
    await expect(app.editorTitle).toHaveValue('Clickable Note');
  });

  test('editing title updates note in the list', async ({ app }) => {
    await app.goto();
    await app.createNote('Original Title');

    await app.editorTitle.fill('Updated Title');
    // Auto-save fires after debounce — wait for list to update
    await expect(app.noteItem('Updated Title')).toBeVisible({ timeout: 3_000 });
  });

  test('note state badge reflects current state', async ({ app }) => {
    await app.seed([{ title: 'Draft Note', state: 'draft' }]);
    await app.goto();

    await app.noteItem('Draft Note').click();

    await expect(app.noteStateBadge).toContainText('Draft');
  });

  test('state transition button changes note state', async ({ app }) => {
    await app.seed([{ title: 'State Changer', state: 'draft' }]);
    await app.goto();
    await app.noteItem('State Changer').click();

    await app.page.getByTestId('btn-state-review').click();

    await expect(app.noteStateBadge).toContainText('Review');
  });

  test('word count shows in status bar', async ({ app }) => {
    await app.seed([{ title: 'Word Counter', content: 'one two three four five' }]);
    await app.goto();

    await app.noteItem('Word Counter').click();

    await expect(app.editorWordCount).toContainText('5');
  });

  test.describe('Pin', () => {
    test('pinning note via toolbar button shows pin indicator in list', async ({ app }) => {
      await app.seed([{ title: 'Pinnable', content: 'Pin me' }]);
      await app.goto();
      await app.noteItem('Pinnable').click();

      await app.page.getByTestId('btn-pin').click();

      await expect(app.noteItem('Pinnable').getByTestId('note-pin-icon')).toBeVisible();
    });

    test('pinned notes appear at the top of the list', async ({ app }) => {
      await app.seed([
        { title: 'Z Last Note', content: 'Last alphabetically' },
        { title: 'A First Note', is_pinned: true, content: 'Pinned' },
      ]);
      await app.goto();

      const items = app.page.getByTestId('note-item');
      await expect(items.first()).toContainText('A First Note');
    });
  });

  test.describe('Trash & Restore', () => {
    test('trashing note via context menu removes it from list', async ({ app }) => {
      await app.seed([{ title: 'To Trash', content: 'delete me' }]);
      await app.goto();

      await app.openNoteContextMenu('To Trash');
      await app.clickContextMenuItem('Move to Trash');

      await expect(app.noteItem('To Trash')).not.toBeVisible();
    });

    test('trashed notes appear in trash view', async ({ app }) => {
      await app.seed([{ title: 'Trashed Note', content: 'in trash' }]);
      await app.goto();

      await app.openNoteContextMenu('Trashed Note');
      await app.clickContextMenuItem('Move to Trash');

      await app.navTrash.click();

      await expect(app.noteItem('Trashed Note')).toBeVisible();
    });

    test('restoring a note moves it back to all notes', async ({ app }) => {
      await app.seed([{ title: 'Restore Me', content: 'restore' }]);
      await app.goto();

      // Trash it
      await app.openNoteContextMenu('Restore Me');
      await app.clickContextMenuItem('Move to Trash');

      // Go to trash, select note, restore
      await app.navTrash.click();
      await app.noteItem('Restore Me').click();
      await app.page.getByTestId('btn-restore').click();

      // Back to all notes — should be visible
      await app.navAllNotes.click();
      await expect(app.noteItem('Restore Me')).toBeVisible();
    });

    test('permanently deleting a note requires confirmation', async ({ app }) => {
      await app.seed([{ title: 'Permanent Delete' }]);
      await app.goto();

      await app.openNoteContextMenu('Permanent Delete');
      await app.clickContextMenuItem('Move to Trash');
      await app.navTrash.click();
      await app.noteItem('Permanent Delete').click();
      await app.page.getByTestId('btn-delete-permanent').click();

      await expect(app.page.getByTestId('confirm-dialog')).toBeVisible();
      await app.confirmDialog();

      await expect(app.noteItem('Permanent Delete')).not.toBeVisible();
    });
  });
});
