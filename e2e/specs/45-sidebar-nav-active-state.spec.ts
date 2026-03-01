/**
 * Sidebar navigation active-state tests
 * Each nav button gains the bg-bear-active class when its panel/view is active,
 * and loses it when another is opened.
 */
import { test, expect } from '../fixtures';

test.describe('Sidebar Nav Active State', () => {
  test('"All Notes" is active by default on app launch', async ({ app }) => {
    await app.goto();

    await expect(app.navAllNotes).toHaveClass(/bg-bear-active/);
  });

  test('"All Notes" is inactive while viewing Trash', async ({ app }) => {
    await app.goto();

    await app.navTrash.click();

    await expect(app.navAllNotes).not.toHaveClass(/bg-bear-active/);
    await expect(app.navTrash).toHaveClass(/bg-bear-active/);
  });

  test('clicking "All Notes" deactivates Trash and reactivates All Notes', async ({ app }) => {
    await app.goto();

    await app.navTrash.click();
    await expect(app.navTrash).toHaveClass(/bg-bear-active/);

    await app.navAllNotes.click();

    await expect(app.navAllNotes).toHaveClass(/bg-bear-active/);
    await expect(app.navTrash).not.toHaveClass(/bg-bear-active/);
  });

  test('"Activity" nav becomes active when the activity panel opens', async ({ app }) => {
    await app.goto();

    await app.navActivity.click();

    await expect(app.navActivity).toHaveClass(/bg-bear-active/);
  });

  test('"Activity" nav becomes inactive when the activity panel is toggled off', async ({ app }) => {
    await app.goto();

    await app.navActivity.click();
    await expect(app.navActivity).toHaveClass(/bg-bear-active/);

    await app.navActivity.click();

    await expect(app.navActivity).not.toHaveClass(/bg-bear-active/);
  });

  test('"Knowledge Graph" nav becomes active when graph view opens', async ({ app }) => {
    await app.goto();

    await app.navGraph.click();

    await expect(app.navGraph).toHaveClass(/bg-bear-active/);
  });

  test('"Knowledge Graph" nav becomes inactive when graph view is toggled off', async ({ app }) => {
    await app.goto();

    await app.navGraph.click();
    await expect(app.navGraph).toHaveClass(/bg-bear-active/);

    await app.navGraph.click();

    await expect(app.navGraph).not.toHaveClass(/bg-bear-active/);
  });

  test('"Tasks" nav becomes active when task panel opens', async ({ app }) => {
    await app.goto();

    await app.navTasks.click();

    await expect(app.navTasks).toHaveClass(/bg-bear-active/);
  });

  test('"Tasks" nav becomes inactive when task panel is toggled off', async ({ app }) => {
    await app.goto();

    await app.navTasks.click();
    await expect(app.navTasks).toHaveClass(/bg-bear-active/);

    await app.navTasks.click();

    await expect(app.navTasks).not.toHaveClass(/bg-bear-active/);
  });

  test('"Agents" nav becomes active when agent dashboard opens', async ({ app }) => {
    await app.goto();

    await app.navAgents.click();

    await expect(app.navAgents).toHaveClass(/bg-bear-active/);
  });

  test('"All Notes" loses active state when a tag is selected', async ({ app }) => {
    await app.seed([{ title: 'Tagged', tags: ['work'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();

    await expect(app.navAllNotes).not.toHaveClass(/bg-bear-active/);
  });

  test('"All Notes" regains active state after clearing the tag filter', async ({ app }) => {
    await app.seed([{ title: 'Tagged', tags: ['work'] }]);
    await app.goto();

    await app.tagTree.getByTestId('tag-item').filter({ hasText: 'work' }).click();
    await expect(app.navAllNotes).not.toHaveClass(/bg-bear-active/);

    await app.navAllNotes.click();

    await expect(app.navAllNotes).toHaveClass(/bg-bear-active/);
  });
});
