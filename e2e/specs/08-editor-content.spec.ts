/**
 * Editor content tests: TipTap body interactions, word count, seeded content
 */
import { test, expect } from '../fixtures';

test.describe('Editor Content', () => {
  test('editor body renders when a note is open', async ({ app }) => {
    await app.seed([{ title: 'My Note', content: 'Hello world' }]);
    await app.goto();

    await app.noteItem('My Note').click();

    await expect(app.page.getByTestId('editor-body')).toBeVisible();
  });

  test('editor body is contenteditable', async ({ app }) => {
    await app.seed([{ title: 'My Note', content: '' }]);
    await app.goto();

    await app.noteItem('My Note').click();

    const proseMirror = app.page.locator('.ProseMirror');
    await expect(proseMirror).toBeVisible();
    await expect(proseMirror).toHaveAttribute('contenteditable', 'true');
  });

  test('seeded note content is visible in the editor', async ({ app }) => {
    await app.seed([{ title: 'My Note', content: 'This is existing content' }]);
    await app.goto();

    await app.noteItem('My Note').click();

    await expect(app.page.locator('.ProseMirror')).toContainText('This is existing content');
  });

  test('typing in the editor body adds text', async ({ app }) => {
    await app.seed([{ title: 'My Note', content: '' }]);
    await app.goto();

    await app.noteItem('My Note').click();
    await app.page.locator('.ProseMirror').click();
    await app.page.keyboard.type('New text typed');

    await expect(app.page.locator('.ProseMirror')).toContainText('New text typed');
  });

  test('word count in status bar reflects seeded content', async ({ app }) => {
    await app.seed([{ title: 'My Note', content: 'one two three four five' }]);
    await app.goto();

    await app.noteItem('My Note').click();

    await expect(app.editorWordCount).toContainText('5');
  });

  test('word count updates after typing and auto-save fires', async ({ app }) => {
    await app.seed([{ title: 'Empty Note', content: '' }]);
    await app.goto();

    await app.noteItem('Empty Note').click();
    await expect(app.editorWordCount).toContainText('0');

    await app.page.locator('.ProseMirror').click();
    await app.page.keyboard.type('alpha beta gamma delta epsilon');

    // Wait for the debounced auto-save to persist to mock DB
    await app.page.waitForFunction(() => {
      const el = document.querySelector('[data-testid="editor-word-count"]');
      return el !== null && parseInt(el.textContent ?? '0') >= 5;
    }, { timeout: 5000 });

    await expect(app.editorWordCount).toContainText('5');
  });

  test('switching notes loads the new note content', async ({ app }) => {
    await app.seed([
      { title: 'Note A', content: 'Content of A' },
      { title: 'Note B', content: 'Content of B' },
    ]);
    await app.goto();

    await app.noteItem('Note A').click();
    await expect(app.page.locator('.ProseMirror')).toContainText('Content of A');

    await app.noteItem('Note B').click();
    await expect(app.page.locator('.ProseMirror')).toContainText('Content of B');
  });
});
