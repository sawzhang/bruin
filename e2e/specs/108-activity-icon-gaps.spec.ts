/**
 * Activity panel icon gap tests: spec 54 covers note_created "+", note_updated "~",
 * note_trashed "!", note_pinned "*", state_changed ">", note_restored "<" — but
 * never tests note_deleted "x" or the "?" fallback for unknown event types.
 * These are the only two entries in EVENT_ICONS / the fallback that remain
 * unasserted. Complements spec 54 (activity item content).
 */
import { test, expect } from '../fixtures';

test.describe('Activity Icon Gaps', () => {
  test('note_deleted event shows "x" icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-deleted',
        event_type: 'note_deleted',
        note_id: null,
        summary: 'Permanently deleted a note',
        actor: 'user',
        agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator(
      '[data-testid="activity-item"][data-event-type="note_deleted"]',
    );
    await expect(item.locator('span.font-mono')).toHaveText('x');
  });

  test('unknown event type shows "?" fallback icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-unknown',
        event_type: 'some_future_event',
        note_id: null,
        summary: 'An unrecognised event',
        actor: 'user',
        agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator(
      '[data-testid="activity-item"][data-event-type="some_future_event"]',
    );
    await expect(item.locator('span.font-mono')).toHaveText('?');
  });

  test('note_deleted event shows the summary text', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-del-summary',
        event_type: 'note_deleted',
        note_id: null,
        summary: 'Deleted "Archived Note"',
        actor: 'user',
        agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator(
      '[data-testid="activity-item"][data-event-type="note_deleted"]',
    );
    await expect(item).toContainText('Deleted "Archived Note"');
  });

  test('note_deleted event has data-event-type="note_deleted" attribute', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-del-attr',
        event_type: 'note_deleted',
        note_id: null,
        summary: 'Deleted a note',
        actor: 'user',
        agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    await expect(
      app.page.locator('[data-testid="activity-item"][data-event-type="note_deleted"]'),
    ).toBeVisible();
  });

  test('all six known event types each render their distinct icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      [
        { id: 'all-created',  event_type: 'note_created',  summary: 'Created',  icon: '+' },
        { id: 'all-updated',  event_type: 'note_updated',  summary: 'Updated',  icon: '~' },
        { id: 'all-deleted',  event_type: 'note_deleted',  summary: 'Deleted',  icon: 'x' },
        { id: 'all-trashed',  event_type: 'note_trashed',  summary: 'Trashed',  icon: '!' },
        { id: 'all-restored', event_type: 'note_restored', summary: 'Restored', icon: '<' },
        { id: 'all-pinned',   event_type: 'note_pinned',   summary: 'Pinned',   icon: '*' },
      ].forEach((e) => {
        window.__TAURI_MOCK_DB__.activities.push({
          id: e.id, event_type: e.event_type, note_id: null,
          summary: e.summary, actor: 'user', agent_id: null, timestamp: now,
        });
      });
    });
    await app.goto();
    await app.navActivity.click();

    // Verify note_deleted "x" specifically (the gap from spec 54)
    await expect(
      app.page
        .locator('[data-testid="activity-item"][data-event-type="note_deleted"]')
        .locator('span.font-mono'),
    ).toHaveText('x');
  });

  test('unknown event renders with the same activity-item testid structure', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-unknown-struct',
        event_type: 'webhook_triggered',
        note_id: null,
        summary: 'Webhook fired',
        actor: 'system',
        agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator(
      '[data-testid="activity-item"][data-event-type="webhook_triggered"]',
    );
    await expect(item).toBeVisible();
    await expect(item.locator('span.font-mono')).toHaveText('?');
    await expect(item).toContainText('Webhook fired');
  });
});
