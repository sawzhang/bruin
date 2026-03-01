import { useEffect, useRef, useCallback } from "react";

export interface ContextMenuItem {
  label: string;
  icon?: string;
  action: () => void;
  variant?: "danger" | "default";
  separator?: boolean;
  disabled?: boolean;
}

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuItem[];
  onClose: () => void;
}

export function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  const adjustPosition = useCallback(() => {
    if (!menuRef.current) return { x, y };
    const rect = menuRef.current.getBoundingClientRect();
    const adjustedX = x + rect.width > window.innerWidth ? x - rect.width : x;
    const adjustedY = y + rect.height > window.innerHeight ? y - rect.height : y;
    return { x: Math.max(0, adjustedX), y: Math.max(0, adjustedY) };
  }, [x, y]);

  useEffect(() => {
    if (menuRef.current) {
      const pos = adjustPosition();
      menuRef.current.style.left = `${pos.x}px`;
      menuRef.current.style.top = `${pos.y}px`;
    }
  }, [adjustPosition]);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    // Delay to avoid catching the triggering right-click
    setTimeout(() => {
      window.addEventListener("click", handleClick);
      window.addEventListener("contextmenu", handleClick);
    }, 0);
    window.addEventListener("keydown", handleKey);
    return () => {
      window.removeEventListener("click", handleClick);
      window.removeEventListener("contextmenu", handleClick);
      window.removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  return (
    <div
      data-testid="context-menu"
      ref={menuRef}
      className="fixed z-[150] bg-bear-sidebar border border-bear-border rounded-lg shadow-2xl py-1 min-w-[180px] animate-scale-in origin-top-left"
      style={{ left: x, top: y }}
    >
      {items.map((item, i) => (
        <div key={i}>
          {item.separator && i > 0 && (
            <div className="mx-2 my-1 border-t border-bear-border" />
          )}
          <button
            data-testid="context-menu-item"
            data-label={item.label}
            onClick={() => {
              if (item.disabled) return;
              item.action();
              onClose();
            }}
            disabled={item.disabled}
            className={`w-full text-left px-3 py-1.5 text-[13px] flex items-center gap-2 transition-colors ${
              item.disabled
                ? "text-bear-text-muted/40 cursor-default"
                : item.variant === "danger"
                  ? "text-red-400 hover:bg-red-500/10"
                  : "text-bear-text hover:bg-bear-hover"
            }`}
          >
            {item.icon && <span className="text-[14px] w-4 text-center">{item.icon}</span>}
            {item.label}
          </button>
        </div>
      ))}
    </div>
  );
}
