/**
 * app-layout and note-list-panel direct testid assertion tests.
 * Neither element is ever targeted via getByTestId() in any prior spec:
 * - app-layout is the root theme wrapper (carries theme-* CSS class)
 * - note-list-panel is the note list column container
 * Complements spec 01 (app launch visibility) and spec 06 (theme change) —
 * neither asserts these testids directly.
 */
import { test, expect } from '../fixtures';

test.describe('App Layout and Note List Panel', () => {
  test('app-layout is visible via getByTestId', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('app-layout')).toBeVisible();
  });

  test('app-layout has the default theme CSS class "theme-dark-graphite"', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('app-layout')).toHaveClass(/theme-dark-graphite/);
  });

  test('note-list-panel is visible via getByTestId', async ({ app }) => {
    await app.goto();

    await expect(app.page.getByTestId('note-list-panel')).toBeVisible();
  });

  test('note-list-panel is visible in All Notes view', async ({ app }) => {
    await app.seed([{ title: 'Panel Visible Note' }]);
    await app.goto();

    await expect(app.page.getByTestId('note-list-panel')).toBeVisible();
  });

  test('app-layout theme class updates when theme is changed', async ({ app }) => {
    await app.goto();

    // Confirm default theme
    await expect(app.page.getByTestId('app-layout')).toHaveClass(/theme-dark-graphite/);

    // Open theme picker and select a different theme
    await app.page.getByTestId('btn-themes').click();
    await app.page.getByTestId('theme-picker').getByText('Bear').click();

    // app-layout class should now reflect the new theme
    await expect(app.page.getByTestId('app-layout')).toHaveClass(/theme-bear/);
    await expect(app.page.getByTestId('app-layout')).not.toHaveClass(/theme-dark-graphite/);
  });

  test('note-list-panel contains the note-search-input', async ({ app }) => {
    await app.goto();

    await expect(
      app.page.getByTestId('note-list-panel').getByTestId('note-search-input'),
    ).toBeVisible();
  });

  test('note-list-panel contains note items when notes exist', async ({ app }) => {
    await app.seed([{ title: 'Panel Contains Note' }]);
    await app.goto();

    await expect(
      app.page.getByTestId('note-list-panel').getByTestId('note-item'),
    ).toBeVisible();
  });

  test('note-list-panel contains note-list-empty when no notes exist', async ({ app }) => {
    await app.goto();

    await expect(
      app.page.getByTestId('note-list-panel').getByTestId('note-list-empty'),
    ).toBeVisible();
  });
});
