import { useEffect } from "react";
import { Command } from "cmdk";
import { useSearch } from "../../hooks/useSearch";
import { useNoteStore } from "../../stores/noteStore";
import { useUIStore } from "../../stores/uiStore";
import { useToastStore } from "../../stores/toastStore";
import * as tauri from "../../lib/tauri";
import { save } from "@tauri-apps/plugin-dialog";
import { writeTextFile } from "@tauri-apps/plugin-fs";

interface PaletteCommand {
  id: string;
  label: string;
  icon: string;
  action: () => void;
}

export function CommandPalette() {
  const isOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const selectNote = useNoteStore((s) => s.selectNote);
  const createNote = useNoteStore((s) => s.createNote);
  const trashNote = useNoteStore((s) => s.trashNote);
  const selectedNoteId = useNoteStore((s) => s.selectedNoteId);
  const addToast = useToastStore((s) => s.addToast);

  const { query, setQuery, results, isSearching } = useSearch();

  // Reset query when closing
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen, setQuery]);

  if (!isOpen) return null;

  const isCommandMode = query.startsWith(">");
  const commandQuery = isCommandMode ? query.slice(1).trim().toLowerCase() : "";

  const commands: PaletteCommand[] = [
    {
      id: "new-note",
      label: "New Note",
      icon: "+",
      action: () => { createNote(); toggleCommandPalette(); },
    },
    ...(selectedNoteId ? [{
      id: "trash-note",
      label: "Trash Note",
      icon: "\u00d7",
      action: () => { trashNote(selectedNoteId); toggleCommandPalette(); },
    }] : []),
    {
      id: "settings",
      label: "Settings",
      icon: "\u2699",
      action: () => { useUIStore.getState().toggleSettings(); toggleCommandPalette(); },
    },
    {
      id: "theme",
      label: "Change Theme",
      icon: "\u263c",
      action: () => { useUIStore.getState().toggleThemePicker(); toggleCommandPalette(); },
    },
    {
      id: "graph",
      label: "Knowledge Graph",
      icon: "\u25ce",
      action: () => { useUIStore.getState().toggleGraphView(); toggleCommandPalette(); },
    },
    {
      id: "activity",
      label: "Activity Feed",
      icon: "\u2261",
      action: () => { useUIStore.getState().toggleActivityPanel(); toggleCommandPalette(); },
    },
    {
      id: "template",
      label: "New from Template",
      icon: "\u229e",
      action: () => { useUIStore.getState().toggleTemplatePicker(); toggleCommandPalette(); },
    },
    {
      id: "workflows",
      label: "Run Workflow...",
      icon: "\u25b6",
      action: () => { useUIStore.getState().toggleWorkflowBrowser(); toggleCommandPalette(); },
    },
    {
      id: "tasks",
      label: "Tasks",
      icon: "\u2610",
      action: () => { useUIStore.getState().toggleTaskPanel(); toggleCommandPalette(); },
    },
    {
      id: "agents",
      label: "Agent Dashboard",
      icon: "\u2b24",
      action: () => { useUIStore.getState().toggleAgentDashboard(); toggleCommandPalette(); },
    },
    ...(selectedNoteId ? [
      {
        id: "export-md",
        label: "Export as Markdown",
        icon: "\u21e9",
        action: async () => {
          toggleCommandPalette();
          try {
            const md = await tauri.exportNoteMarkdown(selectedNoteId);
            const path = await save({ filters: [{ name: "Markdown", extensions: ["md"] }] });
            if (path) { await writeTextFile(path, md); addToast({ type: "success", message: "Exported as Markdown" }); }
          } catch (err) { addToast({ type: "error", message: `Export failed: ${err}` }); }
        },
      },
      {
        id: "export-html",
        label: "Export as HTML",
        icon: "\u21e9",
        action: async () => {
          toggleCommandPalette();
          try {
            const html = await tauri.exportNoteHtml(selectedNoteId);
            const path = await save({ filters: [{ name: "HTML", extensions: ["html"] }] });
            if (path) { await writeTextFile(path, html); addToast({ type: "success", message: "Exported as HTML" }); }
          } catch (err) { addToast({ type: "error", message: `Export failed: ${err}` }); }
        },
      },
    ] : []),
  ];

  const filteredCommands = isCommandMode
    ? commands.filter((c) => c.label.toLowerCase().includes(commandQuery))
    : commands;

  const groupHeadingClass =
    "[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-bear-text-muted [&_[cmdk-group-heading]]:tracking-wider";
  const itemClass =
    "flex items-center gap-2 px-3 py-2 text-[13px] text-bear-text rounded cursor-pointer data-[selected=true]:bg-bear-active";

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]"
      onClick={toggleCommandPalette}
    >
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/50" />

      {/* Palette */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-[560px] max-h-[400px] bg-bear-sidebar border border-bear-border rounded-xl shadow-2xl overflow-hidden"
      >
        <Command shouldFilter={false}>
          <Command.Input
            value={query}
            onValueChange={setQuery}
            placeholder="Search notes... (type > for commands)"
            className="w-full px-4 py-3 text-[14px] bg-transparent text-bear-text placeholder:text-bear-text-muted outline-none border-b border-bear-border"
          />
          <Command.List className="max-h-[300px] overflow-y-auto p-1.5">
            {isSearching && (
              <Command.Loading>
                <p className="px-3 py-2 text-[12px] text-bear-text-muted">
                  Searching...
                </p>
              </Command.Loading>
            )}

            {/* Show commands when empty query or in command mode */}
            {(query.trim() === "" || isCommandMode) && (
              <Command.Group heading="Commands" className={groupHeadingClass}>
                {filteredCommands.map((cmd) => (
                  <Command.Item
                    key={cmd.id}
                    onSelect={cmd.action}
                    className={itemClass}
                  >
                    <span className="text-bear-text-muted w-4 text-center">{cmd.icon}</span>
                    {cmd.label}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {/* Show search results when not in command mode */}
            {!isCommandMode && query.trim() !== "" && results.length > 0 && (
              <Command.Group heading="Notes" className={groupHeadingClass}>
                {results.map((note) => (
                  <Command.Item
                    key={note.id}
                    value={note.id}
                    onSelect={() => {
                      selectNote(note.id);
                      toggleCommandPalette();
                    }}
                    className="flex flex-col px-3 py-2 rounded cursor-pointer data-[selected=true]:bg-bear-active"
                  >
                    <span className="text-[13px] font-medium text-bear-text">
                      {note.title || "Untitled"}
                    </span>
                    <span className="text-[11px] text-bear-text-secondary line-clamp-1">
                      {note.preview}
                    </span>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {!isCommandMode && query.trim() !== "" && !isSearching && results.length === 0 && (
              <Command.Empty className="px-3 py-4 text-[12px] text-bear-text-muted text-center">
                No results found
              </Command.Empty>
            )}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
