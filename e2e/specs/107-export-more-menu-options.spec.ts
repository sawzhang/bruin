/**
 * Export dropdown opened via the "more menu" path: spec 35 tests that clicking
 * "Export..." in the more menu opens the export dropdown and shows "Markdown",
 * but it never asserts "HTML" or "PDF" are visible from that path (the statusbar
 * path test in spec 35 asserts all three). This spec fills that assertion gap and
 * adds further dropdown behaviour for the more-menu trigger.
 * Complements spec 35 (export dropdown).
 */
import { test, expect } from '../fixtures';

async function openExportViaMoreMenu(app: import('../page-objects/AppPage').AppPage) {
  await app.page.getByTestId('btn-more').click();
  await app.page.getByText('Export...').click();
}

test.describe('Export via More Menu Options', () => {
  test('export via more menu shows "HTML" option', async ({ app }) => {
    await app.seed([{ title: 'HTML Export Note' }]);
    await app.goto();
    await app.noteItem('HTML Export Note').click();

    await openExportViaMoreMenu(app);

    await expect(app.page.getByRole('button', { name: 'HTML', exact: true })).toBeVisible();
  });

  test('export via more menu shows "PDF" option', async ({ app }) => {
    await app.seed([{ title: 'PDF Export Note' }]);
    await app.goto();
    await app.noteItem('PDF Export Note').click();

    await openExportViaMoreMenu(app);

    await expect(app.page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  });

  test('export via more menu shows all three format options simultaneously', async ({ app }) => {
    await app.seed([{ title: 'All Formats Note' }]);
    await app.goto();
    await app.noteItem('All Formats Note').click();

    await openExportViaMoreMenu(app);

    await expect(app.page.getByRole('button', { name: 'Markdown', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'HTML', exact: true })).toBeVisible();
    await expect(app.page.getByRole('button', { name: 'PDF', exact: true })).toBeVisible();
  });

  test('export dropdown opened via more menu closes when clicking outside', async ({ app }) => {
    await app.seed([{ title: 'Close Export Note' }]);
    await app.goto();
    await app.noteItem('Close Export Note').click();

    await openExportViaMoreMenu(app);
    await expect(app.page.getByRole('button', { name: 'HTML', exact: true })).toBeVisible();

    await app.page.mouse.click(10, 10);

    await expect(app.page.getByRole('button', { name: 'HTML', exact: true })).not.toBeVisible();
  });

  test('more menu closes after clicking "Export..."', async ({ app }) => {
    await app.seed([{ title: 'More Menu Closes Note' }]);
    await app.goto();
    await app.noteItem('More Menu Closes Note').click();

    await app.page.getByTestId('btn-more').click();
    await expect(app.page.getByText('Export...')).toBeVisible();

    await app.page.getByText('Export...').click();

    // More menu items should no longer be visible; export dropdown is open
    await expect(app.page.getByText('Export...')).not.toBeVisible();
    await expect(app.page.getByRole('button', { name: 'Markdown', exact: true })).toBeVisible();
  });

  test('template-empty text is "No templates available"', async ({ app }) => {
    await app.goto();

    // Open template picker via command palette
    await app.openCommandPalette();
    await app.page.getByTestId('command-palette-input').fill('>');
    await app.page.getByTestId('command-item').filter({ hasText: 'New from Template' }).click();

    await expect(app.page.getByTestId('template-empty')).toHaveText('No templates available');
  });
});
