/**
 * Import markdown files tests
 */
import { test, expect } from '../fixtures';

test.describe('Import', () => {
  test('import button is visible in the sidebar footer', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('btn-import')).toBeVisible();
  });

  test('clicking import when dialog is cancelled does nothing', async ({ app }) => {
    // dialog returns null by default — no files selected
    await app.goto();

    await app.page.getByTestId('btn-import').click();

    // Note list should still be empty
    await expect(app.noteListEmpty).toBeVisible();
  });

  test('importing markdown files adds notes to the note list', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.importFiles = [
        { path: '/notes/meeting.md', title: 'Meeting Notes', content: '## Agenda\n\nDiscuss roadmap.' },
        { path: '/notes/project.md', title: 'Project Plan', content: '## Overview\n\nBuild features.' },
      ];
    });
    await app.goto();

    await app.page.getByTestId('btn-import').click();

    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Meeting Notes' })).toBeVisible();
    await expect(app.page.getByTestId('note-item').filter({ hasText: 'Project Plan' })).toBeVisible();
  });

  test('imported note opens in the editor when clicked', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.importFiles = [
        { path: '/notes/readme.md', title: 'Read Me', content: 'Hello world.' },
      ];
    });
    await app.goto();

    await app.page.getByTestId('btn-import').click();

    await app.page.getByTestId('note-item').filter({ hasText: 'Read Me' }).click();
    await expect(app.editorTitle).toHaveValue('Read Me');
  });

  test('importing a single file adds exactly one note', async ({ app }) => {
    await app.page.addInitScript(() => {
      window.__TAURI_MOCK_DB__.importFiles = [
        { path: '/notes/solo.md', title: 'Solo Note', content: 'Only one.' },
      ];
    });
    await app.goto();

    const beforeCount = await app.page.getByTestId('note-item').count();
    await app.page.getByTestId('btn-import').click();
    const afterCount = await app.page.getByTestId('note-item').count();

    expect(afterCount).toBe(beforeCount + 1);
  });
});
