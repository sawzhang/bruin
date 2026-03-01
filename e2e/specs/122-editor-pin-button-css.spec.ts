/**
 * EditorPanel btn-pin CSS class state tests: spec 52 (editor more menu) tests
 * the title attribute of btn-pin ("Pin note" vs "Unpin note") but never asserts
 * the colour classes that change with pin state:
 * - pinned   → text-bear-accent
 * - unpinned → text-bear-text-muted
 * Complements spec 52 (editor more menu) and spec 32 (pin note).
 */
import { test, expect } from '../fixtures';

test.describe('Editor Pin Button CSS', () => {
  test('btn-pin on unpinned note has text-bear-text-muted class', async ({ app }) => {
    await app.seed([{ title: 'Unpinned CSS Note', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Unpinned CSS Note').click();

    await expect(app.page.getByTestId('btn-pin')).toHaveClass(/text-bear-text-muted/);
  });

  test('btn-pin on pinned note has text-bear-accent class', async ({ app }) => {
    await app.seed([{ title: 'Pinned CSS Note', is_pinned: true }]);
    await app.goto();
    await app.noteItem('Pinned CSS Note').click();

    await expect(app.page.getByTestId('btn-pin')).toHaveClass(/text-bear-accent/);
  });

  test('btn-pin on pinned note does not have text-bear-text-muted class', async ({ app }) => {
    await app.seed([{ title: 'Pinned No Muted Note', is_pinned: true }]);
    await app.goto();
    await app.noteItem('Pinned No Muted Note').click();

    await expect(app.page.getByTestId('btn-pin')).not.toHaveClass(/text-bear-text-muted/);
  });

  test('btn-pin on unpinned note does not have text-bear-accent class', async ({ app }) => {
    await app.seed([{ title: 'Unpinned No Accent Note', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Unpinned No Accent Note').click();

    await expect(app.page.getByTestId('btn-pin')).not.toHaveClass(/text-bear-accent/);
  });

  test('pinning a note changes btn-pin from text-bear-text-muted to text-bear-accent', async ({
    app,
  }) => {
    await app.seed([{ title: 'Toggle Pin CSS Note', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Toggle Pin CSS Note').click();

    await expect(app.page.getByTestId('btn-pin')).toHaveClass(/text-bear-text-muted/);

    await app.page.getByTestId('btn-pin').click();

    await expect(app.page.getByTestId('btn-pin')).toHaveClass(/text-bear-accent/);
  });

  test('btn-pin has hover:text-bear-text class when unpinned', async ({ app }) => {
    await app.seed([{ title: 'Hover Text Note', is_pinned: false }]);
    await app.goto();
    await app.noteItem('Hover Text Note').click();

    await expect(app.page.getByTestId('btn-pin')).toHaveClass(/hover:text-bear-text/);
  });
});
