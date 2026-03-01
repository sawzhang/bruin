/**
 * Sync status indicator tests
 */
import { test, expect } from '../fixtures';

test.describe('Sync Status', () => {
  test('sync status shows "Not synced" by default', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sync-label')).toHaveText('Not synced');
  });

  test('sync-dot is visible in the sidebar footer', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sync-dot')).toBeVisible();
  });

  test('sync status shows "Sync error" when error is set', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.syncState = {
        is_syncing: false,
        last_sync: null,
        error: 'iCloud unreachable',
        files_synced: 0,
      };
    });
    await app.goto();

    await expect(app.page.getByTestId('sync-label')).toHaveText('Sync error');
  });

  test('sync status shows "Syncing..." when is_syncing is true', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.syncState = {
        is_syncing: true,
        last_sync: null,
        error: null,
        files_synced: 0,
      };
    });
    await app.goto();

    await expect(app.page.getByTestId('sync-label')).toHaveText('Syncing...');
  });

  test('sync status shows "Synced" when last_sync is set', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.syncState = {
        is_syncing: false,
        last_sync: new Date().toISOString(),
        error: null,
        files_synced: 3,
      };
    });
    await app.goto();

    await expect(app.page.getByTestId('sync-label')).toHaveText('Synced');
  });
});
