/**
 * Note state lifecycle tests: verify the full state machine
 * (draft → review → published → review → draft) using state buttons
 * and the note-state-badge display.
 * Complements spec 93 (button labels) and spec 100 (context menu transitions)
 * by testing the full lifecycle via button clicks and badge text updates.
 */
import { test, expect } from '../fixtures';

test.describe('Note State Lifecycle', () => {
  test('new draft note shows "draft" in the note-state-badge', async ({ app }) => {
    await app.seed([{ title: 'Fresh Draft', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Fresh Draft').click();

    await expect(app.noteStateBadge).toContainText(/draft/i);
  });

  test('clicking "→ In Review" transitions draft to review', async ({ app }) => {
    await app.seed([{ title: 'Draft to Review', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Draft to Review').click();

    await app.page.getByTestId('btn-state-review').click();

    await expect(app.noteStateBadge).toContainText(/review/i);
  });

  test('clicking "→ Published" transitions review to published', async ({ app }) => {
    await app.seed([{ title: 'Review to Published', state: 'review' }]);
    await app.goto();
    await app.noteItem('Review to Published').click();

    await app.page.getByTestId('btn-state-published').click();

    await expect(app.noteStateBadge).toContainText(/published/i);
  });

  test('full lifecycle: draft → review → published → review → draft', async ({ app }) => {
    await app.seed([{ title: 'Full Lifecycle Note', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Full Lifecycle Note').click();

    // draft → review
    await expect(app.noteStateBadge).toContainText(/draft/i);
    await app.page.getByTestId('btn-state-review').click();
    await expect(app.noteStateBadge).toContainText(/review/i);

    // review → published
    await app.page.getByTestId('btn-state-published').click();
    await expect(app.noteStateBadge).toContainText(/published/i);

    // published → review
    await app.page.getByTestId('btn-state-review').click();
    await expect(app.noteStateBadge).toContainText(/review/i);

    // review → draft
    await app.page.getByTestId('btn-state-draft').click();
    await expect(app.noteStateBadge).toContainText(/draft/i);
  });

  test('published note shows "→ In Review" button but not "→ Draft"', async ({ app }) => {
    await app.seed([{ title: 'Published Options', state: 'published' }]);
    await app.goto();
    await app.noteItem('Published Options').click();

    await expect(app.page.getByTestId('btn-state-review')).toBeVisible();
    await expect(app.page.getByTestId('btn-state-draft')).not.toBeVisible();
  });

  test('draft note shows only "→ In Review" button', async ({ app }) => {
    await app.seed([{ title: 'Draft Options', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Draft Options').click();

    await expect(app.page.getByTestId('btn-state-review')).toBeVisible();
    await expect(app.page.getByTestId('btn-state-published')).not.toBeVisible();
    await expect(app.page.getByTestId('btn-state-draft')).not.toBeVisible();
  });
});
