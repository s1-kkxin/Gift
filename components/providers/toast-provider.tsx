"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type PropsWithChildren } from "react";

type ToastType = "info" | "success" | "error";

type ToastContextValue = {
  show: (type: ToastType, message: string, opts?: { duration?: number }) => void;
  info: (message: string, opts?: { duration?: number }) => void;
  success: (message: string, opts?: { duration?: number }) => void;
  error: (message: string, opts?: { duration?: number }) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function ToastProvider({ children }: PropsWithChildren) {
  const [visible, setVisible] = useState(false);
  const [message, setMessage] = useState("");
  const [type, setType] = useState<ToastType>("info");
  const [mounted, setMounted] = useState(false);
  const timerRef = useRef<number | null>(null);

  const clearTimer = () => {
    if (timerRef.current) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const show = useCallback((t: ToastType, msg: string, opts?: { duration?: number }) => {
    clearTimer();
    setType(t);
    setMessage(msg);
    setMounted(true);
    setVisible(true);
    const duration = opts?.duration ?? 5000;
    timerRef.current = window.setTimeout(() => setVisible(false), duration) as unknown as number;
  }, []);

  const close = useCallback(() => {
    setVisible(false);
    clearTimer();
    setTimeout(() => setMounted(false), 300);
  }, []);

  useEffect(() => () => clearTimer(), []);

  const info = useCallback((msg: string, opts?: { duration?: number }) => show("info", msg, opts), [show]);
  const success = useCallback((msg: string, opts?: { duration?: number }) => show("success", msg, opts), [show]);
  const error = useCallback((msg: string, opts?: { duration?: number }) => show("error", msg, opts), [show]);

  const value = useMemo(() => ({ show, info, success, error }), [show, info, success, error]);

  const bgColor = type === "success" ? "bg-green-600" : type === "error" ? "bg-red-600" : "bg-zinc-800";

  return (
    <ToastContext.Provider value={value}>
      {children}
      {mounted && (
        <div
          className={`fixed top-20 left-1/2 z-[1000] -translate-x-1/2 min-w-[200px] max-w-[90vw] rounded-xl px-4 py-3 text-sm font-medium text-white shadow-xl flex items-center gap-3 transition-all duration-300 ${bgColor} ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 -translate-y-2"
          }`}
          role="status"
        >
          <span className="truncate">{message}</span>
          <button
            onClick={close}
            className="ml-auto w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/20"
          >
            x
          </button>
        </div>
      )}
    </ToastContext.Provider>
  );
}
