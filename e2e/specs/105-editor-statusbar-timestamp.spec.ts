/**
 * Editor statusbar timestamp display tests: the statusbar shows
 * `format(new Date(currentNote.updated_at), "MMM d, yyyy 'at' h:mm a")` as a
 * span next to the Export button. No prior spec (spec 69 covers word-count and
 * badge colours) ever asserts the timestamp text content or its format.
 * Complements spec 69 (editor-statusbar detail).
 */
import { test, expect } from '../fixtures';

test.describe('Editor Statusbar Timestamp', () => {
  test('editor-statusbar contains a formatted timestamp when note is open', async ({ app }) => {
    await app.seed([{ title: 'Timestamp Note' }]);
    await app.goto();
    await app.noteItem('Timestamp Note').click();

    // The timestamp uses format "MMM d, yyyy 'at' h:mm a" — always contains "at"
    await expect(app.page.getByTestId('editor-statusbar')).toContainText('at');
  });

  test('editor statusbar timestamp contains AM or PM', async ({ app }) => {
    await app.seed([{ title: 'AM PM Note' }]);
    await app.goto();
    await app.noteItem('AM PM Note').click();

    const statusbar = app.page.getByTestId('editor-statusbar');
    // date-fns format 'a' produces AM or PM
    const text = await statusbar.innerText();
    expect(text).toMatch(/[AP]M/);
  });

  test('editor statusbar timestamp matches "MMM d, yyyy at h:mm AM/PM" format', async ({
    app,
  }) => {
    await app.seed([{ title: 'Format Check Note' }]);
    await app.goto();
    await app.noteItem('Format Check Note').click();

    const statusbar = app.page.getByTestId('editor-statusbar');
    const text = await statusbar.innerText();
    // Matches e.g. "Mar 1, 2025 at 9:45 AM" or "Dec 12, 2024 at 11:30 PM"
    expect(text).toMatch(/\w{3}\s+\d{1,2},\s+\d{4}\s+at\s+\d{1,2}:\d{2}\s+[AP]M/);
  });

  test('editor statusbar timestamp includes the current year', async ({ app }) => {
    await app.seed([{ title: 'Year Check Note' }]);
    await app.goto();
    await app.noteItem('Year Check Note').click();

    const year = new Date().getFullYear().toString();
    await expect(app.page.getByTestId('editor-statusbar')).toContainText(year);
  });

  test('seeded note with specific updated_at shows matching year in statusbar', async ({
    app,
  }) => {
    await app.page.addInitScript(() => {
      // Set updated_at to a known past date: 2024-06-15T08:00:00Z
      window.__TAURI_MOCK_DB__.notes.push({
        id: 'ts-specific',
        title: 'Specific Date Note',
        content: '',
        state: 'draft',
        is_pinned: false,
        deleted: false,
        word_count: 0,
        tags: [],
        workspace_id: null,
        created_at: '2024-06-15T08:00:00.000Z',
        updated_at: '2024-06-15T08:00:00.000Z',
        version: 1,
      });
    });
    await app.goto();
    await app.page
      .getByTestId('note-item')
      .filter({ hasText: 'Specific Date Note' })
      .click();

    // Year 2024 and month Jun should appear in the formatted timestamp
    await expect(app.page.getByTestId('editor-statusbar')).toContainText('2024');
    await expect(app.page.getByTestId('editor-statusbar')).toContainText('Jun');
  });

  test('editor statusbar timestamp is not visible when no note is open', async ({ app }) => {
    await app.goto();

    // editor-statusbar is not rendered when currentNote is null
    await expect(app.page.getByTestId('editor-statusbar')).not.toBeVisible();
  });

  test('timestamp in statusbar does not contain raw ISO string', async ({ app }) => {
    await app.seed([{ title: 'No ISO Note' }]);
    await app.goto();
    await app.noteItem('No ISO Note').click();

    const statusbar = app.page.getByTestId('editor-statusbar');
    const text = await statusbar.innerText();
    // ISO strings look like "2025-03-01T10:30:00.000Z" — the formatted version should not contain 'T' + time
    expect(text).not.toMatch(/\d{4}-\d{2}-\d{2}T/);
  });
});
