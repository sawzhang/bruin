/**
 * Semantic search AI toggle button tests: the "AI" button next to note-search-input
 * toggles isSemanticSearch mode, which changes the input placeholder text and the
 * button's own title attribute. This feature is completely untested in all prior specs.
 * Complements spec 75 (note-search-input detail) and spec 03 (basic search).
 */
import { test, expect } from '../fixtures';

test.describe('Semantic Search Toggle', () => {
  test('note-search-input default placeholder is "Search notes..."', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-search-input')).toHaveAttribute(
      'placeholder',
      'Search notes...',
    );
  });

  test('AI toggle button is visible in the note list panel', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTitle('Switch to semantic search')).toBeVisible();
  });

  test('AI button default title is "Switch to semantic search"', async ({ app }) => {
    await app.goto();

    const aiBtn = app.page.getByTitle('Switch to semantic search');
    await expect(aiBtn).toHaveText('AI');
  });

  test('clicking AI button changes note-search-input placeholder to "Semantic search..."', async ({ app }) => {
    await app.goto();

    await app.page.getByTitle('Switch to semantic search').click();

    await expect(app.page.getByTestId('note-search-input')).toHaveAttribute(
      'placeholder',
      'Semantic search...',
    );
  });

  test('AI button title becomes "Switch to text search" when semantic is active', async ({ app }) => {
    await app.goto();

    await app.page.getByTitle('Switch to semantic search').click();

    await expect(app.page.getByTitle('Switch to text search')).toBeVisible();
  });

  test('AI button gets active CSS class when semantic search is on', async ({ app }) => {
    await app.goto();

    await app.page.getByTitle('Switch to semantic search').click();

    // Active state uses border-bear-accent class
    await expect(app.page.getByTitle('Switch to text search')).toHaveClass(/border-bear-accent/);
  });

  test('clicking AI button again reverts placeholder to "Search notes..."', async ({ app }) => {
    await app.goto();

    // Turn on semantic search
    await app.page.getByTitle('Switch to semantic search').click();
    await expect(app.page.getByTestId('note-search-input')).toHaveAttribute(
      'placeholder',
      'Semantic search...',
    );

    // Turn off semantic search
    await app.page.getByTitle('Switch to text search').click();
    await expect(app.page.getByTestId('note-search-input')).toHaveAttribute(
      'placeholder',
      'Search notes...',
    );
  });

  test('turning off semantic search reverts AI button title to "Switch to semantic search"', async ({ app }) => {
    await app.goto();

    await app.page.getByTitle('Switch to semantic search').click();
    await app.page.getByTitle('Switch to text search').click();

    await expect(app.page.getByTitle('Switch to semantic search')).toBeVisible();
  });
});
