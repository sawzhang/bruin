import { useToastStore, type ToastType } from "../../stores/toastStore";

const TOAST_STYLES: Record<ToastType, string> = {
  success: "border-green-500/50 text-green-400",
  error: "border-red-500/50 text-red-400",
  info: "border-blue-500/50 text-blue-400",
};

const TOAST_ICONS: Record<ToastType, string> = {
  success: "\u2713",
  error: "\u2717",
  info: "\u24D8",
};

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  const removeToast = useToastStore((s) => s.removeToast);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          data-testid="toast"
          data-toast-type={toast.type}
          className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-lg border bg-bear-sidebar shadow-lg text-[13px] animate-slide-in-right min-w-[260px] max-w-[400px] ${TOAST_STYLES[toast.type]}`}
        >
          <span className="text-[14px] shrink-0">{TOAST_ICONS[toast.type]}</span>
          <span className="flex-1 text-bear-text">{toast.message}</span>
          <button
            onClick={() => removeToast(toast.id)}
            className="shrink-0 text-bear-text-muted hover:text-bear-text text-[12px] ml-2"
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
