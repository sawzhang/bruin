/**
 * Editor more-menu (⋯) tests beyond what spec 21 covers:
 * "Pin to Top" / "Unpin" items, "Export..." item, backdrop close,
 * and editor title behaviour (placeholder, readOnly in trash view).
 */
import { test, expect } from '../fixtures';

test.describe('Editor More Menu', () => {
  test('more menu shows "Pin to Top" for an unpinned note', async ({ app }) => {
    await app.seed([{ title: 'Pinnable Note', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Pinnable Note').click();

    await app.page.getByTestId('btn-more').click();

    await expect(app.page.getByText('Pin to Top')).toBeVisible();
  });

  test('more menu shows "Unpin" for an already-pinned note', async ({ app }) => {
    await app.seed([{ title: 'Already Pinned', is_pinned: true }]);
    await app.goto();
    await app.noteItem('Already Pinned').click();

    await app.page.getByTestId('btn-more').click();

    await expect(app.page.getByText('Unpin')).toBeVisible();
  });

  test('clicking "Pin to Top" in more menu pins the note', async ({ app }) => {
    await app.seed([{ title: 'Pin via More', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Pin via More').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Pin to Top').click();

    await expect(app.noteItem('Pin via More').getByTestId('note-pin-icon')).toBeVisible();
  });

  test('more menu shows "Export..." item', async ({ app }) => {
    await app.seed([{ title: 'Export Note' }]);
    await app.goto();
    await app.noteItem('Export Note').click();

    await app.page.getByTestId('btn-more').click();

    await expect(app.page.getByText('Export...')).toBeVisible();
  });

  test('clicking the backdrop closes the more menu', async ({ app }) => {
    await app.seed([{ title: 'Menu Backdrop Note' }]);
    await app.goto();
    await app.noteItem('Menu Backdrop Note').click();

    await app.page.getByTestId('btn-more').click();
    await expect(app.page.getByText('Move to Trash')).toBeVisible();

    // Click the fixed backdrop that sits behind the dropdown
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByText('Export...')).not.toBeVisible();
  });

  test('more menu closes after clicking "Pin to Top"', async ({ app }) => {
    await app.seed([{ title: 'Menu Close After Pin' }]);
    await app.goto();
    await app.noteItem('Menu Close After Pin').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Pin to Top').click();

    // Dropdown should no longer be visible
    await expect(app.page.getByText('Export...')).not.toBeVisible();
  });

  test('editor title input has "Note title" placeholder', async ({ app }) => {
    await app.goto();
    await app.newNoteBtn.click();

    await expect(app.editorTitle).toHaveAttribute('placeholder', 'Note title');
  });

  test('editor title is read-only when viewing a trashed note', async ({ app }) => {
    await app.seed([{ title: 'Trashed Read Only' }]);
    await app.goto();

    // Trash the note
    await app.openNoteContextMenu('Trashed Read Only');
    await app.clickContextMenuItem('Move to Trash');

    // Open trash, click the note
    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Trashed Read Only' }).click();

    // Title input should be readOnly in trash view
    await expect(app.editorTitle).toHaveAttribute('readonly', '');
  });

  test('btn-pin title attribute says "Unpin" when note is already pinned', async ({ app }) => {
    await app.seed([{ title: 'Pinned Already', is_pinned: true }]);
    await app.goto();
    await app.noteItem('Pinned Already').click();

    await expect(app.page.getByTestId('btn-pin')).toHaveAttribute('title', 'Unpin');
  });

  test('btn-pin title attribute says "Pin to top" when note is unpinned', async ({ app }) => {
    await app.seed([{ title: 'Not Pinned', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Not Pinned').click();

    await expect(app.page.getByTestId('btn-pin')).toHaveAttribute('title', 'Pin to top');
  });
});
