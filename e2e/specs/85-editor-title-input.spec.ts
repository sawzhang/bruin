/**
 * EditorPanel editor-title testid tests: visibility, correct initial value,
 * and editing the title updates the note list item.
 * Complements spec 34 (readOnly in trash, empty state) and spec 52
 * (placeholder "Note title", readOnly) — neither tests the testid directly
 * with value assertions or the note-list update after title edit.
 */
import { test, expect } from '../fixtures';

test.describe('Editor Title Input', () => {
  test('editor-title is visible when a note is selected', async ({ app }) => {
    await app.seed([{ title: 'Title Visible Note' }]);
    await app.goto();
    await app.noteItem('Title Visible Note').click();

    await expect(app.page.getByTestId('editor-title')).toBeVisible();
  });

  test('editor-title is not visible when no note is selected', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('editor-title')).not.toBeVisible();
  });

  test('editor-title value matches the note title on open', async ({ app }) => {
    await app.seed([{ title: 'My Exact Title' }]);
    await app.goto();
    await app.noteItem('My Exact Title').click();

    await expect(app.page.getByTestId('editor-title')).toHaveValue('My Exact Title');
  });

  test('editor-title has type="text"', async ({ app }) => {
    await app.seed([{ title: 'Input Type Note' }]);
    await app.goto();
    await app.noteItem('Input Type Note').click();

    await expect(app.page.getByTestId('editor-title')).toHaveAttribute('type', 'text');
  });

  test('editing editor-title updates the note-item title in the list', async ({ app }) => {
    await app.seed([{ title: 'Original Title' }]);
    await app.goto();
    await app.noteItem('Original Title').click();

    await app.page.getByTestId('editor-title').fill('Updated Title');
    // Trigger blur to fire the update
    await app.page.getByTestId('editor-title').blur();

    await expect(app.noteItem('Updated Title')).toBeVisible();
  });

  test('editor-title is empty string for a newly created note', async ({ app }) => {
    await app.goto();
    await app.createNote();

    // New note has no title yet
    await expect(app.page.getByTestId('editor-title')).toHaveValue('');
  });

  test('switching between two notes updates editor-title value', async ({ app }) => {
    await app.seed([
      { title: 'First Note' },
      { title: 'Second Note' },
    ]);
    await app.goto();

    await app.noteItem('First Note').click();
    await expect(app.page.getByTestId('editor-title')).toHaveValue('First Note');

    await app.noteItem('Second Note').click();
    await expect(app.page.getByTestId('editor-title')).toHaveValue('Second Note');
  });
});
