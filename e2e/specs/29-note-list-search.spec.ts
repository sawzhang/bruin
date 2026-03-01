/**
 * Note list inline search tests: filter by title, content, and clear
 */
import { test, expect } from '../fixtures';

test.describe('Note List Search', () => {
  test('typing in search input filters notes by title', async ({ app }) => {
    await app.seed([
      { title: 'Meeting Notes' },
      { title: 'Shopping List' },
    ]);
    await app.goto();

    await app.searchInput.fill('Meeting');

    await expect(app.noteItem('Meeting Notes')).toBeVisible();
    await expect(app.noteItem('Shopping List')).not.toBeVisible();
  });

  test('clearing search shows all notes again', async ({ app }) => {
    await app.seed([
      { title: 'Alpha Note' },
      { title: 'Beta Note' },
    ]);
    await app.goto();

    await app.searchInput.fill('Alpha');
    await expect(app.noteItem('Beta Note')).not.toBeVisible();

    await app.searchInput.clear();

    await expect(app.noteItem('Alpha Note')).toBeVisible();
    await expect(app.noteItem('Beta Note')).toBeVisible();
  });

  test('search with no match shows empty state', async ({ app }) => {
    await app.seed([{ title: 'Only Note' }]);
    await app.goto();

    await app.searchInput.fill('zzznomatchxyz');

    await expect(app.noteListEmpty).toBeVisible();
    await expect(app.noteItem('Only Note')).not.toBeVisible();
  });

  test('search filters by note content as well as title', async ({ app }) => {
    await app.seed([
      { title: 'First Note', content: 'Contains important keyword here' },
      { title: 'Second Note', content: 'Nothing relevant in this one' },
    ]);
    await app.goto();

    await app.searchInput.fill('important keyword');

    await expect(app.noteItem('First Note')).toBeVisible();
    await expect(app.noteItem('Second Note')).not.toBeVisible();
  });

  test('search is case-insensitive', async ({ app }) => {
    await app.seed([
      { title: 'Project Alpha' },
      { title: 'Daily Standup' },
    ]);
    await app.goto();

    await app.searchInput.fill('project');

    await expect(app.noteItem('Project Alpha')).toBeVisible();
    await expect(app.noteItem('Daily Standup')).not.toBeVisible();
  });
});
