/**
 * Multi-select tests: Shift+click range selection, bulk context menu
 */
import { test, expect } from '../fixtures';

test.describe('Multi-select', () => {
  test('Shift+click selects a second note alongside the first', async ({ app }) => {
    await app.seed([
      { title: 'Alpha Note' },
      { title: 'Beta Note' },
    ]);
    await app.goto();

    await app.noteItem('Alpha Note').click();
    await app.noteItem('Beta Note').click({ modifiers: ['Shift'] });

    // Right-click on Beta (which is now in the selection) — bulk menu should appear
    await app.noteItem('Beta Note').click({ button: 'right' });

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: /Pin \d+ Notes/ })
    ).toBeVisible();
  });

  test('bulk context menu shows "Move N Notes to Trash" option', async ({ app }) => {
    await app.seed([
      { title: 'Gamma Note' },
      { title: 'Delta Note' },
    ]);
    await app.goto();

    await app.noteItem('Gamma Note').click();
    await app.noteItem('Delta Note').click({ modifiers: ['Shift'] });
    await app.noteItem('Delta Note').click({ button: 'right' });

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: /Move \d+ Notes to Trash/ })
    ).toBeVisible();
  });

  test('bulk trash removes all selected notes from the list', async ({ app }) => {
    await app.seed([
      { title: 'Trash Bulk A' },
      { title: 'Trash Bulk B' },
    ]);
    await app.goto();

    await app.noteItem('Trash Bulk A').click();
    await app.noteItem('Trash Bulk B').click({ modifiers: ['Shift'] });
    await app.noteItem('Trash Bulk B').click({ button: 'right' });
    await app.page
      .getByTestId('context-menu-item')
      .filter({ hasText: /Move \d+ Notes to Trash/ })
      .click();

    await expect(app.noteItem('Trash Bulk A')).not.toBeVisible();
    await expect(app.noteItem('Trash Bulk B')).not.toBeVisible();
  });

  test('bulk pin pins all selected notes and shows pin icons', async ({ app }) => {
    await app.seed([
      { title: 'Pin Multi A' },
      { title: 'Pin Multi B' },
    ]);
    await app.goto();

    await app.noteItem('Pin Multi A').click();
    await app.noteItem('Pin Multi B').click({ modifiers: ['Shift'] });
    await app.noteItem('Pin Multi B').click({ button: 'right' });
    await app.page
      .getByTestId('context-menu-item')
      .filter({ hasText: /Pin \d+ Notes/ })
      .click();

    await expect(app.noteItem('Pin Multi A').getByTestId('note-pin-icon')).toBeVisible();
    await expect(app.noteItem('Pin Multi B').getByTestId('note-pin-icon')).toBeVisible();
  });
});
