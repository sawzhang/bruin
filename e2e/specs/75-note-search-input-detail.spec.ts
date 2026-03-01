/**
 * Note list search input attribute and visibility tests.
 * Complements spec 29 (search filter behaviour) and spec 03 (basic search) —
 * neither tests the placeholder attribute text or note-list-panel visibility.
 */
import { test, expect } from '../fixtures';

test.describe('Note Search Input Detail', () => {
  test('note-search-input has placeholder "Search notes..." by default', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-search-input')).toHaveAttribute(
      'placeholder',
      'Search notes...',
    );
  });

  test('note-list-panel is visible in All Notes view', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-panel')).toBeVisible();
  });

  test('note-search-input is visible in All Notes view', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-search-input')).toBeVisible();
  });

  test('note-search-input is visible when a tag filter is active', async ({ app }) => {
    await app.seed([{ title: 'Tag Search Note', tags: ['searchable'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'searchable' }).click();

    await expect(app.page.getByTestId('note-search-input')).toBeVisible();
    await expect(app.page.getByTestId('note-search-input')).toHaveAttribute(
      'placeholder',
      'Search notes...',
    );
  });

  test('note-search-input remains visible in trash view', async ({ app }) => {
    await app.goto();
    await app.navTrash.click();

    await expect(app.page.getByTestId('note-search-input')).toBeVisible();
  });

  test('typing in note-search-input updates its value', async ({ app }) => {
    await app.goto();

    await app.page.getByTestId('note-search-input').fill('hello');

    await expect(app.page.getByTestId('note-search-input')).toHaveValue('hello');
  });
});
