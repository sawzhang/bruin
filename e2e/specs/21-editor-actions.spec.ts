/**
 * Editor panel action tests: state badge, transitions, pin, more menu, tags
 */
import { test, expect } from '../fixtures';

test.describe('Editor Actions', () => {
  test('state badge shows "Draft" for a draft note', async ({ app }) => {
    await app.seed([{ title: 'Draft Note', state: 'draft' }]);
    await app.goto();

    await app.noteItem('Draft Note').click();

    await expect(app.noteStateBadge).toHaveText('Draft');
  });

  test('state badge shows "In Review" for a review note', async ({ app }) => {
    await app.seed([{ title: 'Review Note', state: 'review' }]);
    await app.goto();

    await app.noteItem('Review Note').click();

    await expect(app.noteStateBadge).toHaveText('In Review');
  });

  test('state badge shows "Published" for a published note', async ({ app }) => {
    await app.seed([{ title: 'Published Note', state: 'published' }]);
    await app.goto();

    await app.noteItem('Published Note').click();

    await expect(app.noteStateBadge).toHaveText('Published');
  });

  test('btn-state-review transitions draft note to In Review', async ({ app }) => {
    await app.seed([{ title: 'Transition Note', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Transition Note').click();

    await app.page.getByTestId('btn-state-review').click();

    await expect(app.noteStateBadge).toHaveText('In Review');
  });

  test('btn-state-published transitions review note to Published', async ({ app }) => {
    await app.seed([{ title: 'Publish Note', state: 'review' }]);
    await app.goto();
    await app.noteItem('Publish Note').click();

    await app.page.getByTestId('btn-state-published').click();

    await expect(app.noteStateBadge).toHaveText('Published');
  });

  test('btn-pin pins the current note and shows pin icon in list', async ({ app }) => {
    await app.seed([{ title: 'Pin via Editor' }]);
    await app.goto();
    await app.noteItem('Pin via Editor').click();

    await app.page.getByTestId('btn-pin').click();

    await expect(app.noteItem('Pin via Editor').getByTestId('note-pin-icon')).toBeVisible();
  });

  test('tags are shown in the editor below the state badge', async ({ app }) => {
    await app.seed([
      { title: 'Work Meeting', tags: ['work', 'planning'] },
    ]);
    await app.goto();
    await app.noteItem('Work Meeting').click();

    // Tags should be visible in the editor header area
    await expect(app.page.getByText('#work')).toBeVisible();
    await expect(app.page.getByText('#planning')).toBeVisible();
  });

  test('btn-more opens a dropdown with Move to Trash option', async ({ app }) => {
    await app.seed([{ title: 'More Menu Note' }]);
    await app.goto();
    await app.noteItem('More Menu Note').click();

    await app.page.getByTestId('btn-more').click();

    await expect(app.page.getByText('Move to Trash')).toBeVisible();
  });

  test('Move to Trash from more menu shows confirmation dialog', async ({ app }) => {
    await app.seed([{ title: 'More Trash Note' }]);
    await app.goto();
    await app.noteItem('More Trash Note').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Move to Trash').click();

    await expect(app.page.getByTestId('confirm-btn')).toBeVisible();
  });

  test('btn-restore in trash view restores the note and shows toast', async ({ app }) => {
    await app.seed([{ title: 'Restore via Editor' }]);
    await app.goto();

    // Trash via context menu
    await app.openNoteContextMenu('Restore via Editor');
    await app.clickContextMenuItem('Move to Trash');

    // Open trash, click note, click restore in editor
    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Restore via Editor' }).click();
    await app.page.getByTestId('btn-restore').click();

    await expect(app.page.getByTestId('toast').filter({ hasText: 'Note restored' })).toBeVisible();
  });
});
