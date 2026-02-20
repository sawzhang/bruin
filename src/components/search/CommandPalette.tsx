import { useEffect } from "react";
import { Command } from "cmdk";
import { useSearch } from "../../hooks/useSearch";
import { useNoteStore } from "../../stores/noteStore";
import { useUIStore } from "../../stores/uiStore";

export function CommandPalette() {
  const isOpen = useUIStore((s) => s.isCommandPaletteOpen);
  const toggleCommandPalette = useUIStore((s) => s.toggleCommandPalette);
  const selectNote = useNoteStore((s) => s.selectNote);
  const createNote = useNoteStore((s) => s.createNote);
  const trashNote = useNoteStore((s) => s.trashNote);
  const selectedNoteId = useNoteStore((s) => s.selectedNoteId);

  const { query, setQuery, results, isSearching } = useSearch();

  // Reset query when closing
  useEffect(() => {
    if (!isOpen) setQuery("");
  }, [isOpen, setQuery]);

  if (!isOpen) return null;

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
            placeholder="Search notes or type a command..."
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

            {query.trim() === "" && (
              <Command.Group
                heading="Actions"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-bear-text-muted [&_[cmdk-group-heading]]:tracking-wider"
              >
                <Command.Item
                  onSelect={() => {
                    createNote();
                    toggleCommandPalette();
                  }}
                  className="flex items-center gap-2 px-3 py-2 text-[13px] text-bear-text rounded cursor-pointer data-[selected=true]:bg-bear-active"
                >
                  <span className="text-bear-text-muted">+</span>
                  New Note
                </Command.Item>
                {selectedNoteId && (
                  <Command.Item
                    onSelect={() => {
                      trashNote(selectedNoteId);
                      toggleCommandPalette();
                    }}
                    className="flex items-center gap-2 px-3 py-2 text-[13px] text-bear-text rounded cursor-pointer data-[selected=true]:bg-bear-active"
                  >
                    <span className="text-bear-text-muted">&times;</span>
                    Trash Note
                  </Command.Item>
                )}
              </Command.Group>
            )}

            {query.trim() !== "" && results.length > 0 && (
              <Command.Group
                heading="Notes"
                className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:text-bear-text-muted [&_[cmdk-group-heading]]:tracking-wider"
              >
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

            {query.trim() !== "" && !isSearching && results.length === 0 && (
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
