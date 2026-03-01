import { useEffect } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useNoteStore } from "../../stores/noteStore";
import { useTagStore } from "../../stores/tagStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useKeyboard } from "../../hooks/useKeyboard";
import { Sidebar } from "./Sidebar";
import { NoteList } from "./NoteList";
import { EditorPanel } from "./EditorPanel";
import { Resizer } from "../common/Resizer";
import { CommandPalette } from "../search/CommandPalette";
import { ThemePicker } from "../settings/ThemePicker";
import { SettingsPanel } from "../settings/SettingsPanel";
import { ActivityPanel } from "../activity/ActivityPanel";
import { TemplatePicker } from "../templates/TemplatePicker";
import { KnowledgeGraphView } from "../graph/KnowledgeGraphView";
import { ToastContainer } from "../ui/Toast";
import { ErrorBoundary } from "../ui/ErrorBoundary";
import { TaskPanel } from "../tasks/TaskPanel";
import { AgentDashboard } from "../agents/AgentDashboard";
import { WorkflowBrowser } from "../workflows/WorkflowBrowser";
import { WebhookManager } from "../webhooks/WebhookManager";

export function AppLayout() {
  const sidebarWidth = useUIStore((s) => s.sidebarWidth);
  const noteListWidth = useUIStore((s) => s.noteListWidth);
  const setSidebarWidth = useUIStore((s) => s.setSidebarWidth);
  const setNoteListWidth = useUIStore((s) => s.setNoteListWidth);
  const theme = useUIStore((s) => s.theme);
  const isActivityPanelOpen = useUIStore((s) => s.isActivityPanelOpen);
  const isGraphViewOpen = useUIStore((s) => s.isGraphViewOpen);
  const isTaskPanelOpen = useUIStore((s) => s.isTaskPanelOpen);
  const loadNotes = useNoteStore((s) => s.loadNotes);
  const loadTags = useTagStore((s) => s.loadTags);
  const loadWorkspaces = useWorkspaceStore((s) => s.loadWorkspaces);
  const loadSettings = useSettingsStore((s) => s.loadSettings);

  useKeyboard();

  // Load data on mount
  useEffect(() => {
    loadNotes();
    loadTags();
    loadWorkspaces();
    loadSettings();
  }, [loadNotes, loadTags, loadWorkspaces, loadSettings]);

  return (
    <div data-testid="app-layout" className={`theme-${theme} h-full flex overflow-hidden bg-bear-bg text-bear-text`}>
      {/* Sidebar */}
      <div data-testid="sidebar-wrapper" style={{ width: sidebarWidth }} className="shrink-0 h-full">
        <ErrorBoundary fallbackMessage="Sidebar error">
          <Sidebar />
        </ErrorBoundary>
      </div>

      <Resizer onResize={(d) => setSidebarWidth(sidebarWidth + d)} />

      {isGraphViewOpen ? (
        /* Knowledge Graph View */
        <div data-testid="graph-view" className="flex-1 h-full min-w-0">
          <KnowledgeGraphView />
        </div>
      ) : (
        <>
          {/* Note List */}
          <div data-testid="note-list-wrapper" style={{ width: noteListWidth }} className="shrink-0 h-full">
            <ErrorBoundary fallbackMessage="Note list error">
              <NoteList />
            </ErrorBoundary>
          </div>

          <Resizer onResize={(d) => setNoteListWidth(noteListWidth + d)} />

          {/* Editor */}
          <div data-testid="editor-wrapper" className="flex-1 h-full min-w-0">
            <ErrorBoundary fallbackMessage="Editor error">
              <EditorPanel />
            </ErrorBoundary>
          </div>
        </>
      )}

      {/* Task Panel */}
      {isTaskPanelOpen && (
        <div data-testid="task-panel-wrapper" className="w-[280px] shrink-0 h-full border-l border-bear-border">
          <TaskPanel />
        </div>
      )}

      {/* Activity Panel */}
      {isActivityPanelOpen && (
        <div data-testid="activity-panel-wrapper" className="w-[280px] shrink-0 h-full border-l border-bear-border">
          <ActivityPanel />
        </div>
      )}

      {/* Overlays */}
      <CommandPalette />
      <ThemePicker />
      <TemplatePicker />
      <SettingsPanel />
      <AgentDashboard />
      <WorkflowBrowser />
      <WebhookManager />
      <ToastContainer />
    </div>
  );
}
