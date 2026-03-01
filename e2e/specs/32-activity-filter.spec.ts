/**
 * Activity panel filter tests: filter by agent ID
 */
import { test, expect } from '../fixtures';

test.describe('Activity Filter', () => {
  test('activity filter input is visible and accepts text', async ({ app }) => {
    await app.goto();
    await app.navActivity.click();

    const filter = app.page.getByTestId('activity-filter');
    await filter.fill('some-agent');

    await expect(filter).toHaveValue('some-agent');
  });

  test('filtering by agent ID shows only that agent\'s events', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.activities.push(
        {
          id: 'act-agent-1a',
          event_type: 'note_created',
          note_id: null,
          summary: 'Created by agent-alpha',
          actor: 'agent',
          agent_id: 'agent-alpha',
          timestamp: now,
        },
        {
          id: 'act-agent-1b',
          event_type: 'note_updated',
          note_id: null,
          summary: 'Updated by agent-alpha',
          actor: 'agent',
          agent_id: 'agent-alpha',
          timestamp: now,
        },
        {
          id: 'act-user-1',
          event_type: 'note_created',
          note_id: null,
          summary: 'Created by user',
          actor: 'user',
          agent_id: null,
          timestamp: now,
        },
      );
    });
    await app.goto();
    await app.navActivity.click();

    // Without filter — all 3 events visible
    await expect(app.page.getByTestId('activity-item')).toHaveCount(3);

    // Filter by agent-alpha — only 2 events
    await app.page.getByTestId('activity-filter').fill('agent-alpha');

    await expect(app.page.getByTestId('activity-item')).toHaveCount(2);
  });

  test('clearing the filter restores all events', async ({ app }) => {
    await app.page.addInitScript(() => {
      const now = new Date().toISOString();
      window.__TAURI_MOCK_DB__.activities.push(
        {
          id: 'act-b1',
          event_type: 'note_created',
          note_id: null,
          summary: 'Bot event',
          actor: 'agent',
          agent_id: 'my-bot',
          timestamp: now,
        },
        {
          id: 'act-b2',
          event_type: 'note_updated',
          note_id: null,
          summary: 'User event',
          actor: 'user',
          agent_id: null,
          timestamp: now,
        },
      );
    });
    await app.goto();
    await app.navActivity.click();

    // Filter narrows to 1
    await app.page.getByTestId('activity-filter').fill('my-bot');
    await expect(app.page.getByTestId('activity-item')).toHaveCount(1);

    // Clear filter — both events visible again
    await app.page.getByTestId('activity-filter').clear();
    await expect(app.page.getByTestId('activity-item')).toHaveCount(2);
  });

  test('filter with no matching agent shows empty state', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.activities.push({
        id: 'act-c1',
        event_type: 'note_created',
        note_id: null,
        summary: 'A user event',
        actor: 'user',
        agent_id: null,
        timestamp: new Date().toISOString(),
      });
    });
    await app.goto();
    await app.navActivity.click();

    await app.page.getByTestId('activity-filter').fill('nonexistent-bot-xyz');

    await expect(app.page.getByTestId('activity-empty')).toBeVisible();
    await expect(app.page.getByTestId('activity-item')).toHaveCount(0);
  });
});
