/**
 * Export dropdown tests: statusbar Export button and more-menu Export option
 */
import { test, expect } from '../fixtures';

test.describe('Export Dropdown', () => {
  test('Export button in statusbar is visible when a note is open', async ({ app }) => {
    await app.seed([{ title: 'Export Me' }]);
    await app.goto();
    await app.noteItem('Export Me').click();

    await expect(
      app.editorStatusbar.getByRole('button', { name: 'Export' })
    ).toBeVisible();
  });

  test('clicking Export in statusbar shows Markdown, HTML, PDF options', async ({ app }) => {
    await app.seed([{ title: 'Export Options' }]);
    await app.goto();
    await app.noteItem('Export Options').click();

    await app.editorStatusbar.getByRole('button', { name: 'Export' }).click();

    await expect(app.page.getByRole('button', { name: 'Markdown', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'HTML', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  });

  test('Export dropdown closes when clicking outside', async ({ app }) => {
    await app.seed([{ title: 'Export Close' }]);
    await app.goto();
    await app.noteItem('Export Close').click();

    await app.editorStatusbar.getByRole('button', { name: 'Export' }).click();
    await expect(app.page.getByRole('button', { name: 'Markdown', exact: true })).toBeVisible();

    // Click outside
    await app.page.mouse.click(10, 10);

    await expect(app.page.getByRole('button', { name: 'Markdown', exact: true })).not.toBeVisible();
  });

  test('more menu has an "Export..." option', async ({ app }) => {
    await app.seed([{ title: 'More Export Note' }]);
    await app.goto();
    await app.noteItem('More Export Note').click();

    await app.page.getByTestId('btn-more').click();

    await expect(app.page.getByText('Export...')).toBeVisible();
  });

  test('clicking Export... in more menu opens the export format dropdown', async ({ app }) => {
    await app.seed([{ title: 'More Export Trigger' }]);
    await app.goto();
    await app.noteItem('More Export Trigger').click();

    await app.page.getByTestId('btn-more').click();
    await app.page.getByText('Export...').click();

    // More menu closes and export dropdown opens
    await expect(app.page.getByRole('button', { name: 'Markdown', exact: true })).toBeVisible();
  });

  test('Export button is hidden in trash view', async ({ app }) => {
    await app.seed([{ title: 'Trash Export' }]);
    await app.goto();

    await app.openNoteContextMenu('Trash Export');
    await app.clickContextMenuItem('Move to Trash');

    await app.navTrash.click();
    await app.page.getByTestId('note-item').filter({ hasText: 'Trash Export' }).click();

    // No Export button in statusbar when in trash view
    await expect(
      app.editorStatusbar.getByRole('button', { name: 'Export' })
    ).not.toBeVisible();
  });
});
