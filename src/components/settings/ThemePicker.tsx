import { useEffect, useRef } from "react";
import clsx from "clsx";
import { themes } from "../../lib/themes";
import { useUIStore } from "../../stores/uiStore";

export function ThemePicker() {
  const isOpen = useUIStore((s) => s.isThemePickerOpen);
  const currentTheme = useUIStore((s) => s.theme);
  const setTheme = useUIStore((s) => s.setTheme);
  const toggleThemePicker = useUIStore((s) => s.toggleThemePicker);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        e.preventDefault();
        toggleThemePicker();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [isOpen, toggleThemePicker]);

  if (!isOpen) return null;

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center"
      onClick={(e) => {
        if (e.target === overlayRef.current) toggleThemePicker();
      }}
      style={{ backgroundColor: "rgba(0,0,0,0.5)" }}
    >
      <div className="bg-bear-sidebar rounded-lg shadow-2xl border border-bear-border w-[480px] max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="px-5 pt-5 pb-3">
          <h2 className="text-[15px] font-semibold text-bear-text">Themes</h2>
          <p className="text-[12px] text-bear-text-muted mt-0.5">
            Choose an appearance for Bruin
          </p>
        </div>

        {/* Theme grid */}
        <div className="px-5 pb-5 grid grid-cols-2 gap-3 overflow-y-auto max-h-[60vh]">
          {themes.map((theme) => {
            const isSelected = theme.id === currentTheme;
            const c = theme.colors;
            return (
              <button
                key={theme.id}
                onClick={() => setTheme(theme.id)}
                className={clsx(
                  "rounded-lg border-2 p-3 text-left transition-all duration-150 cursor-pointer",
                  isSelected
                    ? "border-bear-accent shadow-md"
                    : "border-bear-border hover:border-bear-text-muted",
                )}
              >
                {/* Preview card */}
                <div
                  className="rounded-md overflow-hidden border mb-2"
                  style={{
                    borderColor: c["--bear-border"],
                    height: 72,
                  }}
                >
                  <div className="flex h-full">
                    {/* Sidebar preview */}
                    <div
                      className="w-[30%] h-full p-1.5 flex flex-col gap-1"
                      style={{ backgroundColor: c["--bear-sidebar"] }}
                    >
                      <div
                        className="h-1.5 w-[60%] rounded-sm"
                        style={{ backgroundColor: c["--bear-text-muted"] }}
                      />
                      <div
                        className="h-1.5 w-[80%] rounded-sm"
                        style={{ backgroundColor: c["--bear-active"] }}
                      />
                      <div
                        className="h-1.5 w-[50%] rounded-sm"
                        style={{ backgroundColor: c["--bear-text-muted"] }}
                      />
                    </div>
                    {/* Editor preview */}
                    <div
                      className="flex-1 p-1.5 flex flex-col gap-1"
                      style={{ backgroundColor: c["--bear-bg"] }}
                    >
                      <div
                        className="h-2 w-[50%] rounded-sm"
                        style={{ backgroundColor: c["--bear-text"] }}
                      />
                      <div
                        className="h-1.5 w-[90%] rounded-sm opacity-40"
                        style={{ backgroundColor: c["--bear-text"] }}
                      />
                      <div
                        className="h-1.5 w-[70%] rounded-sm opacity-40"
                        style={{ backgroundColor: c["--bear-text"] }}
                      />
                      <div
                        className="h-1.5 w-[40%] rounded-sm"
                        style={{ backgroundColor: c["--bear-accent"] }}
                      />
                    </div>
                  </div>
                </div>

                {/* Theme label */}
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[13px] font-medium text-bear-text">
                      {theme.name}
                    </div>
                    <div className="text-[11px] text-bear-text-muted capitalize">
                      {theme.type}
                    </div>
                  </div>
                  {isSelected && (
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{ backgroundColor: c["--bear-accent"] }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 12 12"
                        fill="none"
                        stroke="white"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="2,6 5,9 10,3" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
