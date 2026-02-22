import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import type { SlashCommandItem } from "./extensions/SlashCommand";

interface SlashCommandMenuProps {
  items: SlashCommandItem[];
  command: (item: SlashCommandItem) => void;
}

export const SlashCommandMenu = forwardRef(
  ({ items, command }: SlashCommandMenuProps, ref) => {
    const [selectedIndex, setSelectedIndex] = useState(0);

    useEffect(() => {
      setSelectedIndex(0);
    }, [items]);

    const selectItem = useCallback(
      (index: number) => {
        const item = items[index];
        if (item) command(item);
      },
      [items, command]
    );

    useImperativeHandle(ref, () => ({
      onKeyDown: ({ event }: { event: KeyboardEvent }) => {
        if (event.key === "ArrowUp") {
          setSelectedIndex((prev) => (prev + items.length - 1) % items.length);
          return true;
        }
        if (event.key === "ArrowDown") {
          setSelectedIndex((prev) => (prev + 1) % items.length);
          return true;
        }
        if (event.key === "Enter") {
          selectItem(selectedIndex);
          return true;
        }
        return false;
      },
    }));

    if (items.length === 0) return null;

    return (
      <div className="bg-bear-sidebar border border-bear-border rounded-lg shadow-xl overflow-hidden py-1 min-w-[200px]">
        {items.map((item, index) => (
          <button
            key={item.title}
            onClick={() => selectItem(index)}
            className={`flex items-center gap-2 w-full text-left px-3 py-1.5 text-[13px] transition-colors duration-100 ${
              index === selectedIndex
                ? "bg-bear-active text-bear-text"
                : "text-bear-text-secondary hover:bg-bear-hover"
            }`}
          >
            <span className="w-6 text-center text-[12px] text-bear-text-muted font-mono">
              {item.icon}
            </span>
            <span>{item.title}</span>
          </button>
        ))}
      </div>
    );
  }
);

SlashCommandMenu.displayName = "SlashCommandMenu";
