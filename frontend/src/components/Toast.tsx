import "./Toast.css";
import React, { createContext, useContext, useReducer, useEffect, useCallback, useRef } from "react";
import ReactDOM from "react-dom";

export type ToastTone = "success" | "warning" | "error" | "info";

export interface ToastInput {
  tone: ToastTone;
  message: string;
}

interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  exiting: boolean;
}

export interface ToastContextValue {
  showToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
}

type ToastAction =
  | { type: "SHOW"; payload: ToastItem }
  | { type: "BEGIN_DISMISS"; id: string }
  | { type: "REMOVE"; id: string };

function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case "SHOW": {
      const next = state.length >= 3 ? state.slice(1) : state;
      return [...next, action.payload];
    }
    case "BEGIN_DISMISS":
      return state.map((toast) => (
        toast.id === action.id ? { ...toast, exiting: true } : toast
      ));
    case "REMOVE":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, string> = {
  success: "✓",
  warning: "⚠",
  error: "✕",
  info: "ℹ",
};

function ToastItem({
  item,
  onDismiss,
  onRemove,
}: {
  item: ToastItem;
  onDismiss: () => void;
  onRemove: () => void;
}) {
  const role = item.tone === "error" ? "alert" : "status";

  useEffect(() => {
    if (item.tone === "error") return undefined;

    const timer = setTimeout(onDismiss, 4000);
    return () => clearTimeout(timer);
  }, [item.id, item.tone]);

  useEffect(() => {
    if (!item.exiting) return undefined;

    const timer = setTimeout(onRemove, 150);
    return () => clearTimeout(timer);
  }, [item.id, item.exiting]);

  return (
    <div
      className={`app-toast app-toast--${item.tone}${item.exiting ? " app-toast--exiting" : ""}`}
      role={role}
    >
      <span className="app-toast__icon" aria-hidden="true">
        {TONE_ICON[item.tone]}
      </span>
      <span className="app-toast__message">{item.message}</span>
      <button
        type="button"
        className="app-toast__close"
        aria-label="Dismiss notification"
        onClick={onDismiss}
      >
        ✕
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, dispatch] = useReducer(toastReducer, []);
  const idCounterRef = useRef(0);

  const showToast = useCallback((input: ToastInput): string => {
    idCounterRef.current += 1;
    const id = String(idCounterRef.current);
    dispatch({ type: "SHOW", payload: { id, ...input, exiting: false } });
    return id;
  }, []);

  const dismissToast = useCallback((id: string) => {
    dispatch({ type: "BEGIN_DISMISS", id });
  }, []);

  const container = typeof document === "undefined"
    ? null
    : ReactDOM.createPortal(
        <div className="app-toast-container">
          {toasts.map((item) => (
            <ToastItem
              key={item.id}
              item={item}
              onDismiss={() => dismissToast(item.id)}
              onRemove={() => dispatch({ type: "REMOVE", id: item.id })}
            />
          ))}
        </div>,
        document.body,
      );

  return (
    <ToastContext.Provider value={{ showToast, dismissToast }}>
      {children}
      {container}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return ctx;
}
