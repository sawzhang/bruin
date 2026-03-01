/**
 * btn-state button label text tests: the rendered text of each state-transition
 * button is never asserted via toHaveText() in any prior spec — they only use
 * toBeVisible() and click(). Complements spec 21 (transitions) and spec 33
 * (revert/multi-button display).
 */
import { test, expect } from '../fixtures';

test.describe('State Button Labels', () => {
  test('btn-state-review on draft note has text "→ In Review"', async ({ app }) => {
    await app.seed([{ title: 'Draft Label Note', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Draft Label Note').click();

    await expect(app.page.getByTestId('btn-state-review')).toHaveText('→ In Review');
  });

  test('btn-state-published on review note has text "→ Published"', async ({ app }) => {
    await app.seed([{ title: 'Review Label Note', state: 'review' }]);
    await app.goto();
    await app.noteItem('Review Label Note').click();

    await expect(app.page.getByTestId('btn-state-published')).toHaveText('→ Published');
  });

  test('btn-state-draft on review note has text "→ Draft"', async ({ app }) => {
    await app.seed([{ title: 'Draft Revert Label Note', state: 'review' }]);
    await app.goto();
    await app.noteItem('Draft Revert Label Note').click();

    await expect(app.page.getByTestId('btn-state-draft')).toHaveText('→ Draft');
  });

  test('btn-state-review on published note has text "→ In Review"', async ({ app }) => {
    await app.seed([{ title: 'Published Label Note', state: 'published' }]);
    await app.goto();
    await app.noteItem('Published Label Note').click();

    await expect(app.page.getByTestId('btn-state-review')).toHaveText('→ In Review');
  });

  test('draft note has exactly one state button (btn-state-review)', async ({ app }) => {
    await app.seed([{ title: 'Draft Single Btn Note', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Draft Single Btn Note').click();

    await expect(app.page.getByTestId('btn-state-review')).toBeVisible();
    await expect(app.page.getByTestId('btn-state-published')).not.toBeVisible();
    await expect(app.page.getByTestId('btn-state-draft')).not.toBeVisible();
  });

  test('review note has exactly two state buttons (btn-state-published and btn-state-draft)', async ({ app }) => {
    await app.seed([{ title: 'Review Two Btn Note', state: 'review' }]);
    await app.goto();
    await app.noteItem('Review Two Btn Note').click();

    await expect(app.page.getByTestId('btn-state-published')).toBeVisible();
    await expect(app.page.getByTestId('btn-state-draft')).toBeVisible();
    await expect(app.page.getByTestId('btn-state-review')).not.toBeVisible();
  });

  test('published note has exactly one state button (btn-state-review)', async ({ app }) => {
    await app.seed([{ title: 'Published Single Btn Note', state: 'published' }]);
    await app.goto();
    await app.noteItem('Published Single Btn Note').click();

    await expect(app.page.getByTestId('btn-state-review')).toBeVisible();
    await expect(app.page.getByTestId('btn-state-published')).not.toBeVisible();
    await expect(app.page.getByTestId('btn-state-draft')).not.toBeVisible();
  });
});
