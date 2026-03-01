/**
 * Two complementary CSS/attribute gap tests:
 *
 * 1. Semantic search AI button active-state CSS: spec 97 asserts only
 *    border-bear-accent when the AI button is toggled on — it never checks
 *    text-bear-accent or bg-bear-accent/10, which NoteList.tsx also applies
 *    in the active branch (lines 498-502).
 *
 * 2. Pin button SVG fill attribute: spec 122 checks the CSS class on btn-pin
 *    but the SVG inside it has fill={is_pinned ? "currentColor" : "none"}
 *    (EditorPanel.tsx line 238) — never tested with toHaveAttribute().
 *
 * Complements spec 97 (semantic search toggle) and spec 122 (pin button CSS).
 */
import { test, expect } from '../fixtures';

test.describe('Semantic Search CSS and Pin SVG Fill', () => {
  // ── Semantic search active CSS ───────────────────────────────────────────────

  test('AI button has text-bear-accent class when semantic search is active', async ({ app }) => {
    await app.goto();

    const aiBtn = app.page.getByTitle('Switch to semantic search');
    await aiBtn.click();

    await expect(app.page.getByTitle('Switch to text search')).toHaveClass(/text-bear-accent/);
  });

  test('AI button has bg-bear-accent/10 class when semantic search is active', async ({ app }) => {
    await app.goto();

    await app.page.getByTitle('Switch to semantic search').click();

    await expect(app.page.getByTitle('Switch to text search')).toHaveClass(/bg-bear-accent\/10/);
  });

  test('AI button loses text-bear-accent when toggled back to text search', async ({ app }) => {
    await app.goto();

    const btn = app.page.getByTitle('Switch to semantic search');
    await btn.click();
    await expect(app.page.getByTitle('Switch to text search')).toHaveClass(/text-bear-accent/);

    await app.page.getByTitle('Switch to text search').click();
    await expect(app.page.getByTitle('Switch to semantic search')).not.toHaveClass(
      /text-bear-accent/,
    );
  });

  test('AI button does not have text-bear-accent when semantic search is inactive', async ({
    app,
  }) => {
    await app.goto();

    await expect(app.page.getByTitle('Switch to semantic search')).not.toHaveClass(
      /text-bear-accent/,
    );
  });

  // ── Pin SVG fill attribute ───────────────────────────────────────────────────

  test('pin button SVG has fill="none" on unpinned note', async ({ app }) => {
    await app.seed([{ title: 'Unpinned Fill Note', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Unpinned Fill Note').click();

    await expect(app.page.getByTestId('btn-pin').locator('svg')).toHaveAttribute('fill', 'none');
  });

  test('pin button SVG has fill="currentColor" on pinned note', async ({ app }) => {
    await app.seed([{ title: 'Pinned Fill Note', is_pinned: true }]);
    await app.goto();
    await app.noteItem('Pinned Fill Note').click();

    await expect(app.page.getByTestId('btn-pin').locator('svg')).toHaveAttribute(
      'fill',
      'currentColor',
    );
  });

  test('pin button SVG fill changes from none to currentColor after pinning', async ({ app }) => {
    await app.seed([{ title: 'Toggle Fill Note', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Toggle Fill Note').click();

    await expect(app.page.getByTestId('btn-pin').locator('svg')).toHaveAttribute('fill', 'none');

    await app.page.getByTestId('btn-pin').click();

    await expect(app.page.getByTestId('btn-pin').locator('svg')).toHaveAttribute(
      'fill',
      'currentColor',
    );
  });
});
