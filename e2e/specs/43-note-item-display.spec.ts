/**
 * Note item display tests: state dot indicator, tags in list items,
 * content preview, and pinned-first sort ordering.
 */
import { test, expect } from '../fixtures';

test.describe('Note Item Display', () => {
  test('draft note shows the draft state dot (title="draft")', async ({ app }) => {
    await app.seed([{ title: 'Draft Note', state: 'draft' }]);
    await app.goto();

    const item = app.noteItem('Draft Note');
    await expect(item.locator('span[title="draft"]')).toBeVisible();
  });

  test('review note shows the review state dot (title="review")', async ({ app }) => {
    await app.seed([{ title: 'Review Note', state: 'review' }]);
    await app.goto();

    const item = app.noteItem('Review Note');
    await expect(item.locator('span[title="review"]')).toBeVisible();
  });

  test('published note shows the published state dot (title="published")', async ({ app }) => {
    await app.seed([{ title: 'Published Note', state: 'published' }]);
    await app.goto();

    const item = app.noteItem('Published Note');
    await expect(item.locator('span[title="published"]')).toBeVisible();
  });

  test('note item shows tags from seeded note', async ({ app }) => {
    await app.seed([{ title: 'Tagged Note', tags: ['design', 'ux'] }]);
    await app.goto();

    const item = app.noteItem('Tagged Note');
    await expect(item.getByText('design')).toBeVisible();
    await expect(item.getByText('ux')).toBeVisible();
  });

  test('note item shows at most 3 tags even if note has more', async ({ app }) => {
    await app.seed([{ title: 'Many Tags Note', tags: ['alpha', 'beta', 'gamma', 'delta'] }]);
    await app.goto();

    const item = app.noteItem('Many Tags Note');
    // Only first 3 of the 4 tags are shown (slice(0, 3))
    await expect(item.getByText('alpha', { exact: true })).toBeVisible();
    await expect(item.getByText('beta', { exact: true })).toBeVisible();
    await expect(item.getByText('gamma', { exact: true })).toBeVisible();
    // 4th tag is cut off
    await expect(item.getByText('delta', { exact: true })).not.toBeVisible();
  });

  test('note item shows content preview text', async ({ app }) => {
    await app.seed([{ title: 'Preview Note', content: 'This is the preview content.' }]);
    await app.goto();

    const item = app.noteItem('Preview Note');
    await expect(item).toContainText('This is the preview content.');
  });

  test('note with no content shows "No content" placeholder', async ({ app }) => {
    await app.seed([{ title: 'Empty Note', content: '' }]);
    await app.goto();

    const item = app.noteItem('Empty Note');
    await expect(item).toContainText('No content');
  });

  test('pinned note appears before unpinned note in the list', async ({ app }) => {
    await app.seed([
      { title: 'Unpinned Note', is_pinned: false },
      { title: 'Pinned Note', is_pinned: true },
    ]);
    await app.goto();

    // The first note-item in the DOM should be the pinned one
    const firstItem = app.page.getByTestId('note-item').first();
    await expect(firstItem).toContainText('Pinned Note');
  });

  test('pinned note shows the pin icon', async ({ app }) => {
    await app.seed([{ title: 'Has Pin', is_pinned: true }]);
    await app.goto();

    await expect(app.noteItem('Has Pin').getByTestId('note-pin-icon')).toBeVisible();
  });

  test('unpinned note does not show the pin icon', async ({ app }) => {
    await app.seed([{ title: 'No Pin', is_pinned: false }]);
    await app.goto();

    await expect(app.noteItem('No Pin').getByTestId('note-pin-icon')).not.toBeVisible();
  });

  test('note item shows a relative timestamp', async ({ app }) => {
    await app.seed([{ title: 'Timestamped Note' }]);
    await app.goto();

    // The item should contain a timestamp phrase like "seconds ago" or "less than a minute ago"
    const item = app.noteItem('Timestamped Note');
    await expect(item).toContainText('ago');
  });
});
