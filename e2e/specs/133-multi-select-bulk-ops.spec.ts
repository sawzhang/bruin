/**
 * Multi-select and bulk operation tests.
 * Complements spec 25 (multi-select basics) by testing selection highlighting,
 * deselection behavior, and additional bulk operation edge cases.
 */
import { test, expect } from '../fixtures';

test.describe('Multi-select Bulk Operations', () => {
  test('Shift+click two notes highlights both with selected styling', async ({ app }) => {
    await app.seed([
      { title: 'Select A' },
      { title: 'Select B' },
      { title: 'Select C' },
    ]);
    await app.goto();

    await app.noteItem('Select A').click();
    await app.noteItem('Select B').click({ modifiers: ['Shift'] });

    // Both selected notes should have the active background
    await expect(app.noteItem('Select A')).toHaveClass(/bg-bear-active/);
    await expect(app.noteItem('Select B')).toHaveClass(/bg-bear-active/);
  });

  test('right-clicking multi-selected notes shows bulk context menu', async ({ app }) => {
    await app.seed([
      { title: 'Bulk Menu A' },
      { title: 'Bulk Menu B' },
    ]);
    await app.goto();

    await app.noteItem('Bulk Menu A').click();
    await app.noteItem('Bulk Menu B').click({ modifiers: ['Shift'] });
    await app.noteItem('Bulk Menu B').click({ button: 'right' });

    const menu = app.page.getByTestId('context-menu');
    await expect(menu).toBeVisible();
    await expect(
      menu.getByTestId('context-menu-item').filter({ hasText: /Pin \d+ Notes/ }),
    ).toBeVisible();
    await expect(
      menu.getByTestId('context-menu-item').filter({ hasText: /Move \d+ Notes to Trash/ }),
    ).toBeVisible();
  });

  test('bulk "Pin N Notes" pins all selected notes', async ({ app }) => {
    await app.seed([
      { title: 'Pin Bulk X' },
      { title: 'Pin Bulk Y' },
    ]);
    await app.goto();

    await app.noteItem('Pin Bulk X').click();
    await app.noteItem('Pin Bulk Y').click({ modifiers: ['Shift'] });
    await app.noteItem('Pin Bulk Y').click({ button: 'right' });

    await app.page
      .getByTestId('context-menu-item')
      .filter({ hasText: /Pin \d+ Notes/ })
      .click();

    await expect(app.noteItem('Pin Bulk X').getByTestId('note-pin-icon')).toBeVisible();
    await expect(app.noteItem('Pin Bulk Y').getByTestId('note-pin-icon')).toBeVisible();
  });

  test('bulk "Move N Notes to Trash" removes all selected notes from the list', async ({ app }) => {
    await app.seed([
      { title: 'Trash Bulk X' },
      { title: 'Trash Bulk Y' },
      { title: 'Remaining Note' },
    ]);
    await app.goto();

    await app.noteItem('Trash Bulk X').click();
    await app.noteItem('Trash Bulk Y').click({ modifiers: ['Shift'] });
    await app.noteItem('Trash Bulk Y').click({ button: 'right' });

    await app.page
      .getByTestId('context-menu-item')
      .filter({ hasText: /Move \d+ Notes to Trash/ })
      .click();

    await expect(app.noteItem('Trash Bulk X')).not.toBeVisible();
    await expect(app.noteItem('Trash Bulk Y')).not.toBeVisible();
    // The unselected note remains
    await expect(app.noteItem('Remaining Note')).toBeVisible();
  });

  test('clicking a single note without Shift deselects all and selects only that note', async ({ app }) => {
    await app.seed([
      { title: 'Deselect A' },
      { title: 'Deselect B' },
      { title: 'Deselect C' },
    ]);
    await app.goto();

    // Multi-select A and B
    await app.noteItem('Deselect A').click();
    await app.noteItem('Deselect B').click({ modifiers: ['Shift'] });

    // Now click C without Shift — should deselect A and B
    await app.noteItem('Deselect C').click();

    // Only C should show the selected note's editor
    await expect(app.editorTitle).toHaveValue('Deselect C');

    // Right-clicking C should show a single-note context menu (no bulk labels)
    await app.noteItem('Deselect C').click({ button: 'right' });
    const menu = app.page.getByTestId('context-menu');
    await expect(menu).toBeVisible();
    await expect(
      menu.getByTestId('context-menu-item').filter({ hasText: /Pin \d+ Notes/ }),
    ).not.toBeVisible();
    await expect(
      menu.getByTestId('context-menu-item').filter({ hasText: 'Pin to Top' }),
    ).toBeVisible();
  });
});
