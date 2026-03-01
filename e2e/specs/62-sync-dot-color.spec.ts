/**
 * Sync dot CSS color class tests: each sync state applies a distinct Tailwind
 * color class to the sync-dot element.
 * Complements spec 13 (sync status label text).
 */
import { test, expect } from '../fixtures';

test.describe('Sync Dot Color', () => {
  test('sync dot has bg-gray-400 class when not synced (default)', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sync-dot')).toHaveClass(/bg-gray-400/);
  });

  test('sync dot does not have bg-green-500 when not yet synced', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('sync-dot')).not.toHaveClass(/bg-green-500/);
  });

  test('sync dot has bg-green-500 class when last_sync is set', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.syncState = {
        is_syncing: false,
        last_sync: new Date().toISOString(),
        error: null,
        files_synced: 1,
      };
    });
    await app.goto();

    await expect(app.page.getByTestId('sync-dot')).toHaveClass(/bg-green-500/);
  });

  test('sync dot has bg-yellow-500 class when is_syncing is true', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.syncState = {
        is_syncing: true,
        last_sync: null,
        error: null,
        files_synced: 0,
      };
    });
    await app.goto();

    await expect(app.page.getByTestId('sync-dot')).toHaveClass(/bg-yellow-500/);
  });

  test('sync dot has animate-pulse class when is_syncing is true', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.syncState = {
        is_syncing: true,
        last_sync: null,
        error: null,
        files_synced: 0,
      };
    });
    await app.goto();

    await expect(app.page.getByTestId('sync-dot')).toHaveClass(/animate-pulse/);
  });

  test('sync dot has bg-red-500 class when error is set', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.syncState = {
        is_syncing: false,
        last_sync: null,
        error: 'iCloud unreachable',
        files_synced: 0,
      };
    });
    await app.goto();

    await expect(app.page.getByTestId('sync-dot')).toHaveClass(/bg-red-500/);
  });

  test('error state dot does not have bg-green-500', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.syncState = {
        is_syncing: false,
        last_sync: null,
        error: 'some error',
        files_synced: 0,
      };
    });
    await app.goto();

    await expect(app.page.getByTestId('sync-dot')).not.toHaveClass(/bg-green-500/);
  });
});
