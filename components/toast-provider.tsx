"use client";

import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { CheckCircle2, AlertCircle, Info, X } from "lucide-react";

type ToastKind = "success" | "error" | "info";
interface Toast { id: number; kind: ToastKind; message: string; }
interface ToastContextValue {
  toast: (m: string, k?: ToastKind) => void;
  success: (m: string) => void;
  error: (m: string) => void;
  info: (m: string) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);
const AUTO_DISMISS_MS = 3500;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = useCallback((id: number) => setToasts((p) => p.filter((t) => t.id !== id)), []);

  const toast = useCallback((message: string, kind: ToastKind = "info") => {
    const id = Date.now() + Math.random();
    setToasts((p) => [...p, { id, kind, message }]);
    window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
  }, [dismiss]);

  return (
    <ToastContext.Provider value={{
      toast,
      success: (m) => toast(m, "success"),
      error: (m) => toast(m, "error"),
      info: (m) => toast(m, "info"),
    }}>
      {children}
      <div className="toast-container" aria-live="polite" aria-atomic="false">
        {toasts.map((t) => {
          const Icon = t.kind === "success" ? CheckCircle2 : t.kind === "error" ? AlertCircle : Info;
          return (
            <div key={t.id} className={`toast toast-${t.kind} animate-toast-in`} role="status">
              <Icon size={18} />
              <span className="flex-1">{t.message}</span>
              <button type="button" onClick={() => dismiss(t.id)} className="text-text-muted bg-transparent border-none cursor-pointer p-0.5" aria-label="Cerrar">
                <X size={14} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    const noop = () => {};
    return { toast: noop, success: noop, error: noop, info: noop };
  }
  return ctx;
}
