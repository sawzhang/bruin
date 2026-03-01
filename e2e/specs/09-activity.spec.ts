/**
 * Activity panel tests
 */
import { test, expect } from '../fixtures';

test.describe('Activity Panel', () => {
  test('clicking Activity nav opens the activity panel', async ({ app }) => {
    await app.goto();

    await app.navActivity.click();

    await expect(app.page.getByTestId('activity-panel')).toBeVisible();
  });

  test('activity panel shows empty state when no events exist', async ({ app }) => {
    await app.goto();

    await app.navActivity.click();

    await expect(app.page.getByTestId('activity-empty')).toBeVisible();
  });

  test('creating a note adds a note_created event in the activity panel', async ({ app }) => {
    await app.goto();

    // Create note through UI so the mock logs a note_created activity
    await app.createNote();

    // Open activity panel
    await app.navActivity.click();

    await expect(
      app.page.locator('[data-testid="activity-item"][data-event-type="note_created"]')
    ).toBeVisible();
  });

  test('trashing a note adds a note_trashed event', async ({ app }) => {
    await app.seed([{ title: 'Trash Me' }]);
    await app.goto();

    const menu = await app.openNoteContextMenu('Trash Me');
    await menu.getByTestId('context-menu-item').filter({ hasText: 'Move to Trash' }).click();

    await app.navActivity.click();

    await expect(
      app.page.locator('[data-testid="activity-item"][data-event-type="note_trashed"]')
    ).toBeVisible();
  });

  test('note state change adds a state_changed event', async ({ app }) => {
    await app.seed([{ title: 'Draft Note', state: 'draft' }]);
    await app.goto();

    await app.noteItem('Draft Note').click();
    await app.page.getByTestId('btn-state-review').click();

    await app.navActivity.click();

    await expect(
      app.page.locator('[data-testid="activity-item"][data-event-type="state_changed"]')
    ).toBeVisible();
  });

  test('activity panel has a filter input', async ({ app }) => {
    await app.goto();
    await app.navActivity.click();

    await expect(app.page.getByTestId('activity-filter')).toBeVisible();
  });

  test('multiple events appear in the activity panel', async ({ app }) => {
    await app.goto();

    await app.createNote();
    await app.createNote();

    await app.navActivity.click();

    const items = app.page.getByTestId('activity-item');
    await expect(items).toHaveCount(2);
    // Both are note_created events
    await expect(items.first()).toHaveAttribute('data-event-type', 'note_created');
    await expect(items.last()).toHaveAttribute('data-event-type', 'note_created');
  });
});
