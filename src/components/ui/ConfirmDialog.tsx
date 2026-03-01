import { useEffect, useRef } from "react";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "default";
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "default",
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const confirmRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) {
      // Focus the cancel button for safety (prevent accidental confirm)
      setTimeout(() => confirmRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div data-testid="confirm-dialog" className="fixed inset-0 z-[200] flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 animate-fade-in"
        onClick={onCancel}
      />
      {/* Dialog */}
      <div className="relative bg-bear-sidebar border border-bear-border rounded-xl shadow-2xl p-6 w-[360px] animate-scale-in">
        <h3 className="text-[15px] font-semibold text-bear-text mb-2">
          {title}
        </h3>
        <p className="text-[13px] text-bear-text-secondary leading-relaxed mb-5">
          {message}
        </p>
        <div className="flex justify-end gap-2">
          <button
            data-testid="cancel-btn"
            onClick={onCancel}
            className="px-3.5 py-1.5 text-[13px] rounded-lg border border-bear-border text-bear-text-secondary hover:bg-bear-hover transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            data-testid="confirm-btn"
            ref={confirmRef}
            onClick={onConfirm}
            className={`px-3.5 py-1.5 text-[13px] rounded-lg font-medium transition-colors ${
              variant === "danger"
                ? "bg-red-600 hover:bg-red-700 text-white"
                : "bg-bear-accent hover:bg-bear-accent-hover text-white"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
