import "./Toast.css";
import React, { createContext, useContext, useReducer, useEffect } from "react";
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
}

export interface ToastContextValue {
  showToast: (input: ToastInput) => string;
  dismissToast: (id: string) => void;
}

type ToastAction =
  | { type: "SHOW"; payload: ToastItem }
  | { type: "DISMISS"; id: string };

function toastReducer(state: ToastItem[], action: ToastAction): ToastItem[] {
  switch (action.type) {
    case "SHOW": {
      const next = state.length >= 3 ? state.slice(1) : state;
      return [...next, action.payload];
    }
    case "DISMISS":
      return state.filter((t) => t.id !== action.id);
    default:
      return state;
  }
}

let _idCounter = 0;
function newId(): string {
  return String(++_idCounter);
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<ToastTone, string> = {
  success: "✓",
  warning: "⚠",
  error: "✕",
  info: "ℹ",
};

function ToastItem({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const role = item.tone === "error" ? "alert" : "status";
  return (
    <div
      className={`app-toast app-toast--${item.tone}`}
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

  const showToast = (input: ToastInput): string => {
    const id = newId();
    dispatch({ type: "SHOW", payload: { id, ...input } });
    return id;
  };

  const dismissToast = (id: string) => {
    dispatch({ type: "DISMISS", id });
  };

  useEffect(() => {
    const timers: ReturnType<typeof setTimeout>[] = [];
    for (const toast of toasts) {
      if (toast.tone !== "error") {
        const t = setTimeout(() => {
          dispatch({ type: "DISMISS", id: toast.id });
        }, 4000);
        timers.push(t);
      }
    }
    return () => {
      for (const t of timers) clearTimeout(t);
    };
  }, [toasts]);

  const container = ReactDOM.createPortal(
    <div className="app-toast-container">
      {toasts.map((item) => (
        <ToastItem
          key={item.id}
          item={item}
          onDismiss={() => dismissToast(item.id)}
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
