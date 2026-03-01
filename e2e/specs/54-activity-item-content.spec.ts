/**
 * Activity panel item content tests: per-event-type icon characters,
 * actor badge, agent badge, summary text, and relative timestamp.
 * Complements spec 09 (basic events) and 32 (agent filter).
 */
import { test, expect } from '../fixtures';

function seedEvent(opts: {
  id: string;
  event_type: string;
  summary: string;
  actor?: string;
  agent_id?: string | null;
}) {
  return {
    id: opts.id,
    event_type: opts.event_type,
    note_id: null,
    summary: opts.summary,
    actor: opts.actor ?? 'user',
    agent_id: opts.agent_id ?? null,
    timestamp: new Date().toISOString(),
  };
}

test.describe('Activity Item Content', () => {
  test('note_created event shows "+" icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-created', event_type: 'note_created', note_id: null,
        summary: 'Created a note', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"][data-event-type="note_created"]');
    await expect(item.locator('span.font-mono')).toHaveText('+');
  });

  test('note_updated event shows "~" icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-updated', event_type: 'note_updated', note_id: null,
        summary: 'Updated a note', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"][data-event-type="note_updated"]');
    await expect(item.locator('span.font-mono')).toHaveText('~');
  });

  test('note_trashed event shows "!" icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-trashed', event_type: 'note_trashed', note_id: null,
        summary: 'Trashed a note', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"][data-event-type="note_trashed"]');
    await expect(item.locator('span.font-mono')).toHaveText('!');
  });

  test('note_pinned event shows "*" icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-pinned', event_type: 'note_pinned', note_id: null,
        summary: 'Pinned a note', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"][data-event-type="note_pinned"]');
    await expect(item.locator('span.font-mono')).toHaveText('*');
  });

  test('state_changed event shows ">" icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-state', event_type: 'state_changed', note_id: null,
        summary: 'State changed to review', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"][data-event-type="state_changed"]');
    await expect(item.locator('span.font-mono')).toHaveText('>');
  });

  test('note_restored event shows "<" icon', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-restored', event_type: 'note_restored', note_id: null,
        summary: 'Restored a note', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"][data-event-type="note_restored"]');
    await expect(item.locator('span.font-mono')).toHaveText('<');
  });

  test('user event shows "user" actor badge', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-actor-user', event_type: 'note_created', note_id: null,
        summary: 'User created a note', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"]').first();
    await expect(item.locator('span.text-bear-tag')).toHaveText('user');
  });

  test('agent event shows "agent" accent badge in addition to actor badge', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-actor-agent', event_type: 'note_updated', note_id: null,
        summary: 'Agent updated a note', actor: 'agent', agent_id: 'my-bot',
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"]').first();
    // The "agent" badge uses bg-bear-accent/20 color class
    await expect(item.locator('span[class*="bg-bear-accent"]')).toBeVisible();
    await expect(item.locator('span[class*="bg-bear-accent"]')).toHaveText('agent');
  });

  test('activity item shows the event summary text', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-summary', event_type: 'note_created', note_id: null,
        summary: 'Created "My Special Note"', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"]').first();
    await expect(item).toContainText('Created "My Special Note"');
  });

  test('activity item shows a relative timestamp', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'ic-timestamp', event_type: 'note_created', note_id: null,
        summary: 'A timestamped event', actor: 'user', agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    const item = app.page.locator('[data-testid="activity-item"]').first();
    await expect(item).toContainText('ago');
  });
});
