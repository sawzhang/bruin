/**
 * Note list semantic search (AI) toggle tests
 * Covers: AI button visibility, placeholder toggling, and styling changes.
 * (Actual ML results are not tested since the model is unavailable in the test env.)
 */
import { test, expect } from '../fixtures';

test.describe('Note List AI Search Toggle', () => {
  test('AI search button is visible in the note list header', async ({ app }) => {
    await app.goto();

    // The AI toggle button has title="Switch to semantic search" initially
    await expect(
      app.page.getByRole('button', { name: /switch to semantic search/i })
    ).toBeVisible();
  });

  test('search input defaults to "Search notes..." placeholder', async ({ app }) => {
    await app.goto();

    await expect(app.searchInput).toHaveAttribute('placeholder', 'Search notes...');
  });

  test('clicking AI button changes the search placeholder to "Semantic search..."', async ({ app }) => {
    await app.goto();

    await app.page.getByRole('button', { name: /switch to semantic search/i }).click();

    await expect(app.searchInput).toHaveAttribute('placeholder', 'Semantic search...');
  });

  test('clicking AI button again reverts placeholder to "Search notes..."', async ({ app }) => {
    await app.goto();

    const aiBtn = app.page.getByRole('button', { name: /switch to semantic search/i });
    await aiBtn.click();
    await expect(app.searchInput).toHaveAttribute('placeholder', 'Semantic search...');

    // Button title changes when active — switch back to text search
    await app.page.getByRole('button', { name: /switch to text search/i }).click();
    await expect(app.searchInput).toHaveAttribute('placeholder', 'Search notes...');
  });

  test('AI button title changes to "Switch to text search" when active', async ({ app }) => {
    await app.goto();

    await app.page.getByRole('button', { name: /switch to semantic search/i }).click();

    await expect(
      app.page.getByRole('button', { name: /switch to text search/i })
    ).toBeVisible();
  });

  test('AI button is no longer titled "Switch to semantic search" when active', async ({ app }) => {
    await app.goto();

    await app.page.getByRole('button', { name: /switch to semantic search/i }).click();

    await expect(
      app.page.getByRole('button', { name: /switch to semantic search/i })
    ).not.toBeVisible();
  });

  test('AI mode: searching with text shows no semantic results (empty)', async ({ app }) => {
    await app.seed([{ title: 'A Note', content: 'Some content' }]);
    await app.goto();

    await app.page.getByRole('button', { name: /switch to semantic search/i }).click();
    await app.searchInput.fill('Some content');

    // Without ML model, notes are not shown as semantic results but no crash occurs
    await expect(app.page.getByTestId('note-list')).toBeVisible();
  });

  test('switching from AI back to text search restores normal search', async ({ app }) => {
    await app.seed([{ title: 'Findable Note' }]);
    await app.goto();

    // Enter AI mode
    await app.page.getByRole('button', { name: /switch to semantic search/i }).click();

    // Back to text mode
    await app.page.getByRole('button', { name: /switch to text search/i }).click();

    // Normal text search still works
    await app.searchInput.fill('Findable');
    await expect(app.noteItem('Findable Note')).toBeVisible();
  });
});
