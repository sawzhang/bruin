import clsx from "clsx";

interface EmptyStateProps {
  icon?: string;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export function EmptyState({
  icon = "\u{1F4DD}",
  message,
  actionLabel,
  onAction,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={clsx(
        "flex flex-col items-center justify-center h-full text-bear-text-muted select-none gap-3",
        className,
      )}
    >
      <span className="text-4xl opacity-40">{icon}</span>
      <p className="text-sm">{message}</p>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="mt-1 px-4 py-1.5 text-xs rounded bg-bear-accent text-white hover:bg-bear-accent-hover transition-colors duration-150"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
}
