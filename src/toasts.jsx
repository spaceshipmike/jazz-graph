import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";

const ToastContext = createContext(null);

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const nextIdRef = useRef(1);

  const dismissToast = useCallback((id) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const showToast = useCallback((message, options = {}) => {
    const id = nextIdRef.current++;
    const toast = {
      id,
      message,
      tone: options.tone || "neutral",
    };
    setToasts((current) => [...current, toast]);
    const duration = options.duration ?? 3200;
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== id));
    }, duration);
    return id;
  }, []);

  const value = useMemo(() => ({ dismissToast, showToast }), [dismissToast, showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} dismissToast={dismissToast} />
    </ToastContext.Provider>
  );
}

export function useToasts() {
  return useContext(ToastContext);
}

function ToastViewport({ toasts, dismissToast }) {
  if (!toasts.length) return null;

  return (
    <div className="toast-viewport" aria-live="polite" aria-atomic="true">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-card toast-${toast.tone}`}>
          <div className="mono toast-message">{toast.message}</div>
          <button type="button" className="mono toast-dismiss" onClick={() => dismissToast(toast.id)}>
            Close
          </button>
        </div>
      ))}
    </div>
  );
}
