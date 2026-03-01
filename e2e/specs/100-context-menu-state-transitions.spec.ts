/**
 * Context menu state transition tests for review and published notes.
 * Spec 19 only tests draft→review ("Set Review") and checks the note remains
 * visible — it never tests "Set Published" or "Set Draft" menu items, nor does
 * it verify that the state dot in the note list actually changes after the
 * context menu action. These are genuine behavioral gaps.
 */
import { test, expect } from '../fixtures';

test.describe('Context Menu State Transitions', () => {
  test('"Set Published" appears in context menu for a review note', async ({ app }) => {
    await app.seed([{ title: 'Review State Note', state: 'review' }]);
    await app.goto();

    const menu = await app.openNoteContextMenu('Review State Note');

    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Set Published' })).toBeVisible();
  });

  test('"Set Draft" appears in context menu for a published note', async ({ app }) => {
    await app.seed([{ title: 'Published State Note', state: 'published' }]);
    await app.goto();

    const menu = await app.openNoteContextMenu('Published State Note');

    await expect(menu.getByTestId('context-menu-item').filter({ hasText: 'Set Draft' })).toBeVisible();
  });

  test('"Set Review" does not appear for a review note', async ({ app }) => {
    await app.seed([{ title: 'Review No Review Item', state: 'review' }]);
    await app.goto();

    const menu = await app.openNoteContextMenu('Review No Review Item');

    // next state from review is published, so "Set Review" must not appear
    await expect(menu.getByTestId('context-menu-item').filter({ hasText: /^Set Review$/ })).not.toBeVisible();
  });

  test('clicking "Set Published" on review note changes state dot to "published"', async ({ app }) => {
    await app.seed([{ title: 'Promote to Published', state: 'review' }]);
    await app.goto();

    await app.openNoteContextMenu('Promote to Published');
    await app.clickContextMenuItem('Set Published');

    // State dot title attribute should now be "published"
    await expect(
      app.noteItem('Promote to Published').locator('span[title="published"]'),
    ).toBeVisible();
  });

  test('clicking "Set Draft" on published note changes state dot to "draft"', async ({ app }) => {
    await app.seed([{ title: 'Demote to Draft', state: 'published' }]);
    await app.goto();

    await app.openNoteContextMenu('Demote to Draft');
    await app.clickContextMenuItem('Set Draft');

    await expect(
      app.noteItem('Demote to Draft').locator('span[title="draft"]'),
    ).toBeVisible();
  });

  test('clicking "Set Review" on draft note changes state dot to "review"', async ({ app }) => {
    await app.seed([{ title: 'Promote to Review', state: 'draft' }]);
    await app.goto();

    await app.openNoteContextMenu('Promote to Review');
    await app.clickContextMenuItem('Set Review');

    await expect(
      app.noteItem('Promote to Review').locator('span[title="review"]'),
    ).toBeVisible();
  });

  test('note remains visible in list after state transition via context menu', async ({ app }) => {
    await app.seed([{ title: 'State Change Still Visible', state: 'review' }]);
    await app.goto();

    await app.openNoteContextMenu('State Change Still Visible');
    await app.clickContextMenuItem('Set Published');

    await expect(app.noteItem('State Change Still Visible')).toBeVisible();
  });

  test('context menu shows correct next-state label for each state', async ({ app }) => {
    // draft → "Set Review", review → "Set Published", published → "Set Draft"
    await app.seed([
      { title: 'Draft For Label', state: 'draft' },
      { title: 'Review For Label', state: 'review' },
      { title: 'Published For Label', state: 'published' },
    ]);
    await app.goto();

    const draftMenu = await app.openNoteContextMenu('Draft For Label');
    await expect(draftMenu.getByTestId('context-menu-item').filter({ hasText: 'Set Review' })).toBeVisible();
    await app.page.keyboard.press('Escape');

    const reviewMenu = await app.openNoteContextMenu('Review For Label');
    await expect(reviewMenu.getByTestId('context-menu-item').filter({ hasText: 'Set Published' })).toBeVisible();
    await app.page.keyboard.press('Escape');

    const publishedMenu = await app.openNoteContextMenu('Published For Label');
    await expect(publishedMenu.getByTestId('context-menu-item').filter({ hasText: 'Set Draft' })).toBeVisible();
  });
});
