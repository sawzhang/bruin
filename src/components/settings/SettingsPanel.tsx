import { useUIStore } from "../../stores/uiStore";
import { useSettingsStore } from "../../stores/settingsStore";
import { useWorkspaceStore } from "../../stores/workspaceStore";
import { AgentListPanel } from "../agents/AgentListPanel";

const FONT_OPTIONS = [
  { label: "System Default", value: "system-ui" },
  { label: "Inter", value: "Inter, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "SF Mono", value: "'SF Mono', monospace" },
];

const AUTO_SAVE_OPTIONS = [
  { label: "500ms", value: "500" },
  { label: "1 second", value: "1000" },
  { label: "2 seconds", value: "2000" },
  { label: "5 seconds", value: "5000" },
];

export function SettingsPanel() {
  const isOpen = useUIStore((s) => s.isSettingsOpen);
  const toggleSettings = useUIStore((s) => s.toggleSettings);
  const settings = useSettingsStore();
  const workspaces = useWorkspaceStore((s) => s.workspaces);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={toggleSettings}
    >
      <div className="fixed inset-0 bg-black/50" />
      <div
        data-testid="settings-panel"
        onClick={(e) => e.stopPropagation()}
        className="relative w-[480px] max-h-[80vh] bg-bear-sidebar border border-bear-border rounded-xl shadow-2xl overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-bear-border">
          <h2 className="text-[16px] font-semibold text-bear-text">Settings</h2>
          <button
            onClick={toggleSettings}
            className="text-bear-text-muted hover:text-bear-text text-[18px]"
          >
            &times;
          </button>
        </div>

        <div className="px-6 py-4 flex flex-col gap-6">
          {/* Appearance */}
          <section>
            <h3 className="text-[12px] uppercase tracking-wider text-bear-text-muted font-medium mb-3">
              Appearance
            </h3>
            <div className="flex flex-col gap-3">
              <SettingRow label="Font Family">
                <select
                  data-testid="settings-font-family"
                  value={settings.fontFamily}
                  onChange={(e) => settings.setSetting("fontFamily", e.target.value)}
                  className="bg-bear-hover border border-bear-border rounded px-2 py-1 text-[13px] text-bear-text outline-none"
                >
                  {FONT_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="Font Size">
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={12}
                    max={24}
                    value={settings.fontSize}
                    onChange={(e) => settings.setSetting("fontSize", e.target.value)}
                    className="w-24 accent-bear-accent"
                  />
                  <span className="text-[13px] text-bear-text-secondary w-8 text-right">
                    {settings.fontSize}
                  </span>
                </div>
              </SettingRow>
            </div>
          </section>

          {/* Editor */}
          <section>
            <h3 className="text-[12px] uppercase tracking-wider text-bear-text-muted font-medium mb-3">
              Editor
            </h3>
            <div className="flex flex-col gap-3">
              <SettingRow label="Auto-save Interval">
                <select
                  data-testid="settings-auto-save"
                  value={String(settings.autoSaveInterval)}
                  onChange={(e) => settings.setSetting("autoSaveInterval", e.target.value)}
                  className="bg-bear-hover border border-bear-border rounded px-2 py-1 text-[13px] text-bear-text outline-none"
                >
                  {AUTO_SAVE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </SettingRow>
              <SettingRow label="Spell Check">
                <Toggle
                  checked={settings.spellCheck}
                  onChange={(v) => settings.setSetting("spellCheck", String(v))}
                />
              </SettingRow>
              <SettingRow label="Line Numbers">
                <Toggle
                  checked={settings.showLineNumbers}
                  onChange={(v) => settings.setSetting("showLineNumbers", String(v))}
                />
              </SettingRow>
            </div>
          </section>

          {/* Agents */}
          <section>
            <h3 className="text-[12px] uppercase tracking-wider text-bear-text-muted font-medium mb-3">
              Agents
            </h3>
            <AgentListPanel />
          </section>

          {/* Webhooks */}
          <section>
            <h3 className="text-[12px] uppercase tracking-wider text-bear-text-muted font-medium mb-3">
              Integrations
            </h3>
            <button
              data-testid="btn-manage-webhooks"
              onClick={() => {
                toggleSettings();
                useUIStore.getState().toggleWebhookManager();
              }}
              className="text-[13px] text-bear-accent hover:underline"
            >
              Manage Webhooks
            </button>
          </section>

          {/* Defaults */}
          <section>
            <h3 className="text-[12px] uppercase tracking-wider text-bear-text-muted font-medium mb-3">
              Defaults
            </h3>
            <SettingRow label="Default Workspace">
              <select
                value={settings.defaultWorkspaceId ?? ""}
                onChange={(e) => settings.setSetting("defaultWorkspaceId", e.target.value)}
                className="bg-bear-hover border border-bear-border rounded px-2 py-1 text-[13px] text-bear-text outline-none"
              >
                <option value="">None</option>
                {workspaces.map((ws) => (
                  <option key={ws.id} value={ws.id}>
                    {ws.name}
                  </option>
                ))}
              </select>
            </SettingRow>
          </section>
        </div>
      </div>
    </div>
  );
}

function SettingRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[13px] text-bear-text">{label}</span>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`relative w-9 h-5 rounded-full transition-colors duration-200 ${
        checked ? "bg-bear-accent" : "bg-bear-hover border border-bear-border"
      }`}
    >
      <span
        className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
          checked ? "translate-x-4" : ""
        }`}
      />
    </button>
  );
}
