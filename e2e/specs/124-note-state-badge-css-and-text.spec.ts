/**
 * note-state-badge CSS colour and label text tests: EditorPanel.tsx renders a
 * badge with STATE_COLORS (draft→bg-gray-400, review→bg-yellow-500,
 * published→bg-green-500) and STATE_LABELS (draft→"Draft", review→"In Review",
 * published→"Published"). Spec 93 only tests the btn-state-* transition buttons
 * (text + visibility) — it never calls toHaveClass() or toHaveText() on the
 * note-state-badge itself.
 * Complements spec 93 (btn-state labels) and spec 21 (state transitions).
 */
import { test, expect } from '../fixtures';

test.describe('Note State Badge CSS and Text', () => {
  test('draft badge has bg-gray-400 class', async ({ app }) => {
    await app.seed([{ title: 'Draft Badge CSS Note', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Draft Badge CSS Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toHaveClass(/bg-gray-400/);
  });

  test('review badge has bg-yellow-500 class', async ({ app }) => {
    await app.seed([{ title: 'Review Badge CSS Note', state: 'review' }]);
    await app.goto();
    await app.noteItem('Review Badge CSS Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toHaveClass(/bg-yellow-500/);
  });

  test('published badge has bg-green-500 class', async ({ app }) => {
    await app.seed([{ title: 'Published Badge CSS Note', state: 'published' }]);
    await app.goto();
    await app.noteItem('Published Badge CSS Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toHaveClass(/bg-green-500/);
  });

  test('draft badge has text "Draft"', async ({ app }) => {
    await app.seed([{ title: 'Draft Badge Text Note', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Draft Badge Text Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toContainText('Draft');
  });

  test('review badge has text "In Review"', async ({ app }) => {
    await app.seed([{ title: 'Review Badge Text Note', state: 'review' }]);
    await app.goto();
    await app.noteItem('Review Badge Text Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toContainText('In Review');
  });

  test('published badge has text "Published"', async ({ app }) => {
    await app.seed([{ title: 'Published Badge Text Note', state: 'published' }]);
    await app.goto();
    await app.noteItem('Published Badge Text Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toContainText('Published');
  });

  test('badge always has text-white class regardless of state', async ({ app }) => {
    await app.seed([{ title: 'Badge White Text Note', state: 'review' }]);
    await app.goto();
    await app.noteItem('Badge White Text Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toHaveClass(/text-white/);
  });

  test('badge has rounded-full class', async ({ app }) => {
    await app.seed([{ title: 'Badge Rounded Note', state: 'draft' }]);
    await app.goto();
    await app.noteItem('Badge Rounded Note').click();

    await expect(app.page.getByTestId('note-state-badge')).toHaveClass(/rounded-full/);
  });
});
