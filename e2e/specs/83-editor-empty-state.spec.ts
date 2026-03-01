/**
 * EditorPanel empty-state tests: editor-empty-state testid content and
 * visibility in additional scenarios beyond spec 34 (which tests the core
 * empty-state vs selected-note flow). Tests exact message text, All Notes
 * navigation not deselecting the current note, and testid-direct assertions.
 */
import { test, expect } from '../fixtures';

test.describe('Editor Empty State', () => {
  test('editor-empty-state is visible when no note is selected', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('editor-empty-state')).toBeVisible();
  });

  test('editor-panel is not visible when no note is selected', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('editor-panel')).not.toBeVisible();
  });

  test('editor-empty-state is not visible when a note is selected', async ({ app }) => {
    await app.seed([{ title: 'Has Content Note' }]);
    await app.goto();
    await app.noteItem('Has Content Note').click();

    await expect(app.page.getByTestId('editor-empty-state')).not.toBeVisible();
  });

  test('editor-panel is visible when a note is selected', async ({ app }) => {
    await app.seed([{ title: 'Visible Editor Note' }]);
    await app.goto();
    await app.noteItem('Visible Editor Note').click();

    await expect(app.page.getByTestId('editor-panel')).toBeVisible();
  });

  test('editor-empty-state contains "Select a note to start editing" message', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('editor-empty-state')).toContainText(
      'Select a note to start editing',
    );
  });

  test('editor-empty-state contains "Create your first note" action', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('editor-empty-state')).toContainText(
      'Create your first note',
    );
  });

  test('clicking All Notes when a note is open keeps editor-panel visible', async ({ app }) => {
    await app.seed([{ title: 'Stay Open Note' }]);
    await app.goto();
    await app.noteItem('Stay Open Note').click();
    await expect(app.page.getByTestId('editor-panel')).toBeVisible();

    // Clicking All Notes does not deselect the current note
    await app.navAllNotes.click();

    await expect(app.page.getByTestId('editor-panel')).toBeVisible();
    await expect(app.page.getByTestId('editor-empty-state')).not.toBeVisible();
  });
});
