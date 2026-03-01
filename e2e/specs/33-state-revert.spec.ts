/**
 * State revert tests: review→draft, published→review, and multi-button display
 */
import { test, expect } from '../fixtures';

test.describe('State Revert', () => {
  test('review note shows both "→ Published" and "→ Draft" buttons', async ({ app }) => {
    await app.seed([{ title: 'Review Note', state: 'review' }]);
    await app.goto();
    await app.noteItem('Review Note').click();

    await expect(app.page.getByTestId('btn-state-published')).toBeVisible();
    await expect(app.page.getByTestId('btn-state-draft')).toBeVisible();
  });

  test('btn-state-draft reverts review note to Draft', async ({ app }) => {
    await app.seed([{ title: 'Revert to Draft', state: 'review' }]);
    await app.goto();
    await app.noteItem('Revert to Draft').click();

    await app.page.getByTestId('btn-state-draft').click();

    await expect(app.noteStateBadge).toHaveText('Draft');
  });

  test('btn-state-review on published note reverts to In Review', async ({ app }) => {
    await app.seed([{ title: 'Revert to Review', state: 'published' }]);
    await app.goto();
    await app.noteItem('Revert to Review').click();

    await app.page.getByTestId('btn-state-review').click();

    await expect(app.noteStateBadge).toHaveText('In Review');
  });

  test('published note shows only "→ In Review" button', async ({ app }) => {
    await app.seed([{ title: 'Published Note', state: 'published' }]);
    await app.goto();
    await app.noteItem('Published Note').click();

    await expect(app.page.getByTestId('btn-state-review')).toBeVisible();
    await expect(app.page.getByTestId('btn-state-draft')).not.toBeVisible();
    await expect(app.page.getByTestId('btn-state-published')).not.toBeVisible();
  });

  test('full cycle: draft → review → published → review → draft', async ({ app }) => {
    await app.seed([{ title: 'Cycle Note', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Cycle Note').click();

    // draft → review
    await app.page.getByTestId('btn-state-review').click();
    await expect(app.noteStateBadge).toHaveText('In Review');

    // review → published
    await app.page.getByTestId('btn-state-published').click();
    await expect(app.noteStateBadge).toHaveText('Published');

    // published → review
    await app.page.getByTestId('btn-state-review').click();
    await expect(app.noteStateBadge).toHaveText('In Review');

    // review → draft
    await app.page.getByTestId('btn-state-draft').click();
    await expect(app.noteStateBadge).toHaveText('Draft');
  });
});
