/**
 * Tag multi-select visual feedback tests: spec 04 tests that Shift+clicking
 * a second tag applies AND filtering to the note list, but never asserts the
 * visual state of the tag items themselves — specifically that both selected
 * tags have the bg-bear-active CSS class simultaneously.
 * Spec 78 tests bg-bear-active for single tag selection only.
 * Complements spec 04 (tag AND filtering) and spec 78 (tag item styles).
 */
import { test, expect } from '../fixtures';

test.describe('Tag Multi-select Active Style', () => {
  test('first selected tag has bg-bear-active after single click', async ({ app }) => {
    await app.seed([{ title: 'A Note', tags: ['alpha', 'beta'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'alpha' }).click();

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'alpha' }),
    ).toHaveClass(/bg-bear-active/);
  });

  test('both tags have bg-bear-active after Shift+click selects a second tag', async ({ app }) => {
    await app.seed([
      { title: 'Both Tags Note', tags: ['work', 'important'] },
      { title: 'Work Only Note', tags: ['work'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'important' }).click({
      modifiers: ['Shift'],
    });

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }),
    ).toHaveClass(/bg-bear-active/);
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'important' }),
    ).toHaveClass(/bg-bear-active/);
  });

  test('clicking "All Notes" clears bg-bear-active from all tags', async ({ app }) => {
    await app.seed([
      { title: 'Clear Test Note', tags: ['clear-a', 'clear-b'] },
    ]);
    await app.goto();

    // Select two tags
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'clear-a' }).click();
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'clear-b' }).click({
      modifiers: ['Shift'],
    });

    // Both should be active
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'clear-a' }),
    ).toHaveClass(/bg-bear-active/);

    // Click All Notes to deselect everything
    await app.navAllNotes.click();

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'clear-a' }),
    ).not.toHaveClass(/bg-bear-active/);
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'clear-b' }),
    ).not.toHaveClass(/bg-bear-active/);
  });

  test('Shift+clicking an already-selected tag removes its bg-bear-active', async ({ app }) => {
    await app.seed([
      { title: 'Toggle Tag Note', tags: ['tog-a', 'tog-b'] },
    ]);
    await app.goto();

    // Select both
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'tog-a' }).click();
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'tog-b' }).click({
      modifiers: ['Shift'],
    });
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'tog-b' }),
    ).toHaveClass(/bg-bear-active/);

    // Shift+click tog-b again to remove it from selection
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'tog-b' }).click({
      modifiers: ['Shift'],
    });

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'tog-b' }),
    ).not.toHaveClass(/bg-bear-active/);
    // tog-a should still be selected
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 'tog-a' }),
    ).toHaveClass(/bg-bear-active/);
  });

  test('three tags all show bg-bear-active when all three are selected', async ({ app }) => {
    await app.seed([
      { title: 'Triple Tag Note', tags: ['t1', 't2', 't3'] },
    ]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 't1' }).click();
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 't2' }).click({
      modifiers: ['Shift'],
    });
    await app.tagTree.getByTestId('tag-item').filter({ hasText: 't3' }).click({
      modifiers: ['Shift'],
    });

    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 't1' }),
    ).toHaveClass(/bg-bear-active/);
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 't2' }),
    ).toHaveClass(/bg-bear-active/);
    await expect(
      app.tagTree.getByTestId('tag-item').filter({ hasText: 't3' }),
    ).toHaveClass(/bg-bear-active/);
  });
});
