import { useState, useEffect } from "react";
import { useUIStore } from "../../stores/uiStore";
import { useNoteStore } from "../../stores/noteStore";
import { listTemplates, createNoteFromTemplate } from "../../lib/tauri";
import type { Template } from "../../types/template";

export function TemplatePicker() {
  const isOpen = useUIStore((s) => s.isTemplatePickerOpen);
  const toggle = useUIStore((s) => s.toggleTemplatePicker);
  const loadNotes = useNoteStore((s) => s.loadNotes);
  const selectNote = useNoteStore((s) => s.selectNote);

  const [templates, setTemplates] = useState<Template[]>([]);

  useEffect(() => {
    if (isOpen) {
      listTemplates().then(setTemplates).catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSelect = async (template: Template) => {
    try {
      const note = await createNoteFromTemplate(template.id);
      toggle();
      await loadNotes();
      await selectNote(note.id);
    } catch {
      // ignore
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
      onClick={toggle}
    >
      <div
        className="bg-bear-bg border border-bear-border rounded-lg shadow-xl w-[440px] max-h-[400px] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-bear-border">
          <h2 className="text-[15px] font-semibold text-bear-text">
            New from Template
          </h2>
        </div>
        <div className="overflow-y-auto max-h-[340px]">
          {templates.map((t) => (
            <button
              key={t.id}
              onClick={() => handleSelect(t)}
              className="w-full text-left px-4 py-3 border-b border-bear-border/50 hover:bg-bear-hover transition-colors"
            >
              <div className="text-[14px] font-medium text-bear-text">
                {t.name}
              </div>
              <p className="text-[12px] text-bear-text-secondary mt-0.5">
                {t.description}
              </p>
              <div className="flex gap-1 mt-1">
                {t.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] px-1.5 py-0.5 rounded bg-bear-tag-bg text-bear-tag"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          ))}
          {templates.length === 0 && (
            <p className="px-4 py-6 text-[12px] text-bear-text-muted text-center">
              No templates available
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
