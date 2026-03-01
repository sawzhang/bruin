/**
 * Activity panel header/text detail tests, plus multi-select bulk tag-removal
 * context menu item (when a tag filter is active).
 *
 * Activity detail:
 *   Complements spec 09 (events) and spec 32 (filter) — tests heading text,
 *   empty-state text, and filter placeholder (not covered there).
 *
 * Multi-select tag removal:
 *   Complements spec 25 (pin/trash N Notes) and spec 44 (single-note Remove Tag) —
 *   the "Remove Tag #tag from N Notes" bulk option has never been tested.
 */
import { test, expect } from '../fixtures';

test.describe('Activity Panel Detail', () => {
  test('activity panel shows "Activity" heading', async ({ app }) => {
    await app.goto();
    await app.navActivity.click();

    await expect(
      app.page.getByTestId('activity-panel').getByRole('heading', { name: 'Activity' }),
    ).toBeVisible();
  });

  test('activity-empty element says "No activity yet"', async ({ app }) => {
    await app.goto();
    await app.navActivity.click();

    await expect(app.page.getByTestId('activity-empty')).toHaveText('No activity yet');
  });

  test('activity-filter has placeholder "Filter by agent..."', async ({ app }) => {
    await app.goto();
    await app.navActivity.click();

    await expect(app.page.getByTestId('activity-filter')).toHaveAttribute(
      'placeholder',
      'Filter by agent...',
    );
  });
});

test.describe('Multi-select Bulk Tag Removal', () => {
  test('"Remove Tag #tag from N Notes" appears in multi-select menu when tag filter is active', async ({ app }) => {
    await app.seed([
      { title: 'Bulk Tag A', tags: ['dev'] },
      { title: 'Bulk Tag B', tags: ['dev'] },
    ]);
    await app.goto();

    // Activate the "dev" tag filter
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'dev' }).click();

    // Multi-select both notes
    await app.noteItem('Bulk Tag A').click();
    await app.noteItem('Bulk Tag B').click({ modifiers: ['Shift'] });

    // Right-click on the second note to open context menu
    await app.noteItem('Bulk Tag B').click({ button: 'right' });

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: /Remove Tag #dev from \d+ Notes/ }),
    ).toBeVisible();
  });

  test('clicking "Remove Tag #tag from N Notes" removes the tag from all selected notes', async ({ app }) => {
    await app.seed([
      { title: 'Remove Tag X', tags: ['shared'] },
      { title: 'Remove Tag Y', tags: ['shared'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'shared' }).click();

    await app.noteItem('Remove Tag X').click();
    await app.noteItem('Remove Tag Y').click({ modifiers: ['Shift'] });
    await app.noteItem('Remove Tag Y').click({ button: 'right' });

    await app.page
      .getByTestId('context-menu-item')
      .filter({ hasText: /Remove Tag #shared from \d+ Notes/ })
      .click();

    // Both notes should disappear from the "shared" tag-filtered view
    await expect(app.noteItem('Remove Tag X')).not.toBeVisible();
    await expect(app.noteItem('Remove Tag Y')).not.toBeVisible();
  });

  test('"Remove Tag #tag from N Notes" does NOT appear when no tag filter is active', async ({ app }) => {
    await app.seed([
      { title: 'No Filter A', tags: ['other'] },
      { title: 'No Filter B', tags: ['other'] },
    ]);
    await app.goto();

    // Stay on All Notes (no tag filter)
    await app.noteItem('No Filter A').click();
    await app.noteItem('No Filter B').click({ modifiers: ['Shift'] });
    await app.noteItem('No Filter B').click({ button: 'right' });

    await expect(
      app.page.getByTestId('context-menu-item').filter({ hasText: /Remove Tag/ }),
    ).not.toBeVisible();
  });
});
