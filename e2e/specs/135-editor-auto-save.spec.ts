/**
 * Editor auto-save tests: title blur saves, content updates word count,
 * switching notes preserves changes, and new note title appears in list.
 * Verifies the debounced auto-save mechanism works correctly for both
 * title and content editing scenarios.
 */
import { test, expect } from '../fixtures';

test.describe('Editor Auto-Save', () => {
  test('editing title and blurring updates the note list title', async ({ app }) => {
    await app.seed([{ title: 'Before Edit', content: 'some content' }]);
    await app.goto();

    await app.noteItem('Before Edit').click();
    await app.editorTitle.fill('After Edit');
    await app.editorTitle.blur();

    await expect(app.noteItem('After Edit')).toBeVisible({ timeout: 3_000 });
    await expect(app.noteItem('Before Edit')).not.toBeVisible();
  });

  test('editing content updates word count in status bar', async ({ app }) => {
    await app.seed([{ title: 'Word Count Note', content: '' }]);
    await app.goto();

    await app.noteItem('Word Count Note').click();
    await expect(app.editorWordCount).toContainText('0');

    await app.page.locator('.ProseMirror').click();
    await app.page.keyboard.type('one two three four five six');

    // Wait for debounced auto-save to update word count
    await app.page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="editor-word-count"]');
      return el !== null && parseInt(el.textContent ?? '0') >= 6;
    }, { timeout: 5000 });

    await expect(app.editorWordCount).toContainText('6');
  });

  test('switching notes preserves previous note changes', async ({ app }) => {
    await app.seed([
      { title: 'Note Alpha', content: 'alpha content' },
      { title: 'Note Beta', content: 'beta content' },
    ]);
    await app.goto();

    // Edit Note Alpha's title
    await app.noteItem('Note Alpha').click();
    await app.editorTitle.fill('Note Alpha Edited');
    await app.editorTitle.blur();
    await expect(app.noteItem('Note Alpha Edited')).toBeVisible({ timeout: 3_000 });

    // Switch to Note Beta
    await app.noteItem('Note Beta').click();
    await expect(app.editorTitle).toHaveValue('Note Beta');

    // Note Alpha's edited title should still be in the list
    await expect(app.noteItem('Note Alpha Edited')).toBeVisible();
  });

  test('creating a note and editing its title shows new title in list', async ({ app }) => {
    await app.goto();

    await app.createNote();
    // Default title is "Untitled"
    await expect(app.editorTitle).toHaveValue('Untitled');

    await app.editorTitle.fill('Freshly Named');
    await app.editorTitle.blur();

    await expect(app.noteItem('Freshly Named')).toBeVisible({ timeout: 3_000 });
  });
});
