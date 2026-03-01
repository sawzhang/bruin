/**
 * AppPage — Page Object Model for the Bruin app.
 *
 * Usage pattern:
 *   const app = new AppPage(page);
 *   await app.seed([{ title: 'My Note' }]);   // optional: pre-load data
 *   await app.goto();                          // navigate + wait for ready
 */
import { type Page, type Locator, expect } from '@playwright/test';

export interface SeedNote {
  id?: string;
  title: string;
  content?: string;
  tags?: string[];
  state?: 'draft' | 'review' | 'published';
  is_pinned?: boolean;
}

export class AppPage {
  readonly page: Page;

  // Sidebar
  readonly sidebar: Locator;
  readonly newNoteBtn: Locator;
  readonly navAllNotes: Locator;
  readonly navTrash: Locator;
  readonly navGraph: Locator;
  readonly navTasks: Locator;
  readonly navActivity: Locator;
  readonly navAgents: Locator;
  readonly tagTree: Locator;
  readonly syncStatus: Locator;
  readonly btnSettings: Locator;
  readonly btnThemes: Locator;

  // Note list
  readonly noteList: Locator;
  readonly searchInput: Locator;
  readonly noteListEmpty: Locator;

  // Editor
  readonly editorEmptyState: Locator;
  readonly editorPanel: Locator;
  readonly editorTitle: Locator;
  readonly editorStatusbar: Locator;
  readonly editorWordCount: Locator;
  readonly noteStateBadge: Locator;

  constructor(page: Page) {
    this.page = page;

    this.sidebar = page.getByTestId('sidebar');
    this.newNoteBtn = page.getByTestId('new-note-btn');
    this.navAllNotes = page.getByTestId('nav-all-notes');
    this.navTrash = page.getByTestId('nav-trash');
    this.navGraph = page.getByTestId('nav-graph');
    this.navTasks = page.getByTestId('nav-tasks');
    this.navActivity = page.getByTestId('nav-activity');
    this.navAgents = page.getByTestId('nav-agents');
    this.tagTree = page.getByTestId('tag-tree');
    this.syncStatus = page.getByTestId('sync-status');
    this.btnSettings = page.getByTestId('btn-settings');
    this.btnThemes = page.getByTestId('btn-themes');

    this.noteList = page.getByTestId('note-list');
    this.searchInput = page.getByTestId('note-search-input');
    this.noteListEmpty = page.getByTestId('note-list-empty');

    this.editorEmptyState = page.getByTestId('editor-empty-state');
    this.editorPanel = page.getByTestId('editor-panel');
    this.editorTitle = page.getByTestId('editor-title');
    this.editorStatusbar = page.getByTestId('editor-statusbar');
    this.editorWordCount = page.getByTestId('editor-word-count');
    this.noteStateBadge = page.getByTestId('note-state-badge');
  }

  /**
   * Pre-seed notes into the mock DB BEFORE navigating.
   * Must be called before goto().
   */
  async seed(notes: SeedNote[]) {
    await this.page.addInitScript((seedNotes: SeedNote[]) => {
      // Runs after tauri-mock.js (init scripts execute in registration order)
      var nowStr = new Date().toISOString();
      var seq = 1000;
      seedNotes.forEach(function (n) {
        var id = n.id || ('seed-' + (seq++));
        var tags = n.tags || [];
        window.__TAURI_MOCK_DB__.notes.push({
          id: id,
          title: n.title,
          content: n.content || '',
          state: n.state || 'draft',
          is_pinned: n.is_pinned || false,
          deleted: false,
          word_count: (n.content || '').split(/\s+/).filter(Boolean).length,
          tags: tags,
          workspace_id: null,
          created_at: nowStr,
          updated_at: nowStr,
          version: 1,
        });
        function syncTag(tag: string) {
          var parts = tag.split('/');
          if (parts.length > 1) { syncTag(parts.slice(0, -1).join('/')); }
          var parentName = parts.length > 1 ? parts.slice(0, -1).join('/') : null;
          if (!window.__TAURI_MOCK_DB__.tags.find(function (t: { name: string }) { return t.name === tag; })) {
            window.__TAURI_MOCK_DB__.tags.push({ name: tag, parent_name: parentName, is_pinned: false });
          }
        }
        tags.forEach(syncTag);
      });
    }, notes);
  }

  /** Navigate to the app and wait until the mock + stores are ready. */
  async goto() {
    await this.page.goto('/');
    await this.page.waitForFunction(() => typeof window.__TAURI_MOCK_DB__ !== 'undefined');
    await expect(this.sidebar).toBeVisible({ timeout: 10_000 });
  }

  /** Create a note via the UI and return the editor title locator. */
  async createNote(title?: string): Promise<Locator> {
    await this.newNoteBtn.click();
    await expect(this.editorTitle).toBeVisible();
    if (title) {
      await this.editorTitle.fill(title);
    }
    return this.editorTitle;
  }

  /** Get a note-item locator filtered by title text. */
  noteItem(titleText: string): Locator {
    return this.page.getByTestId('note-item').filter({ hasText: titleText });
  }

  /** Open command palette with Cmd+K. */
  async openCommandPalette(): Promise<Locator> {
    await this.page.keyboard.press('Meta+k');
    const palette = this.page.getByTestId('command-palette');
    await expect(palette).toBeVisible();
    return palette;
  }

  /** Right-click a note item and return the context menu. */
  async openNoteContextMenu(titleText: string): Promise<Locator> {
    await this.noteItem(titleText).click({ button: 'right' });
    const menu = this.page.getByTestId('context-menu');
    await expect(menu).toBeVisible();
    return menu;
  }

  /** Click a context menu item by its label text. */
  async clickContextMenuItem(label: string) {
    await this.page
      .getByTestId('context-menu-item')
      .filter({ hasText: label })
      .click();
  }

  /** Confirm the currently open ConfirmDialog. */
  async confirmDialog() {
    await this.page.getByTestId('confirm-btn').click();
  }

  /** Cancel the currently open ConfirmDialog. */
  async cancelDialog() {
    await this.page.getByTestId('cancel-btn').click();
  }
}

// Extend Window type for TypeScript
declare global {
  interface Window {
    __TAURI_MOCK_DB__: {
      notes: Array<Record<string, unknown>>;
      tags: Array<Record<string, unknown>>;
      workspaces: Array<Record<string, unknown>>;
      settings: Record<string, string>;
      activities: Array<Record<string, unknown>>;
      _noteSeq: number;
      _actSeq: number;
    };
    __TAURI_INTERNALS__: {
      invoke: (cmd: string, payload?: unknown) => Promise<unknown>;
      transformCallback: (cb: unknown, once?: boolean) => number;
      metadata: unknown;
      ipc: unknown;
    };
    __tauri_callbacks?: Record<string, unknown>;
  }
}
