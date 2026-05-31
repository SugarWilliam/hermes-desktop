import { useState, useCallback, createContext, useContext, memo } from "react";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

// ── Types ─────────────────────────────────────────────

type ToastType = "success" | "error" | "warning" | "info";

interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  addToast: (type: ToastType, message: string) => void;
}

// ── Context ───────────────────────────────────────────

const ToastContext = createContext<ToastContextValue>({
  addToast: () => {},
});

export function useToast(): ToastContextValue {
  return useContext(ToastContext);
}

// ── Icons ─────────────────────────────────────────────

const TOAST_ICONS: Record<ToastType, React.ComponentType<{ size?: number; className?: string }>> = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

// ── Provider ──────────────────────────────────────────

let toastId = 0;

export const ToastProvider = memo(function ToastProvider({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const addToast = useCallback((type: ToastType, message: string) => {
    const id = ++toastId;
    setToasts((prev) => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div className="toast-container" aria-live="polite">
        {toasts.map((toast) => {
          const Icon = TOAST_ICONS[toast.type];
          return (
            <div key={toast.id} className={`toast toast--${toast.type}`}>
              <Icon size={14} className="toast-icon" />
              <span className="toast-message">{toast.message}</span>
              <button className="toast-dismiss" onClick={() => dismiss(toast.id)}>
                <X size={12} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
});
