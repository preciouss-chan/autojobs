"use client";

import { useState, useEffect } from "react";

export interface ToastMessage {
  readonly id: string;
  readonly type: "success" | "error" | "info";
  readonly message: string;
  readonly duration?: number;
}

interface ToastProps {
  readonly message: ToastMessage;
  readonly onClose: (id: string) => void;
}

function Toast({ message, onClose }: ToastProps): React.ReactElement {
  useEffect(() => {
    const duration = message.duration || 5000;
    const timer = setTimeout(() => {
      onClose(message.id);
    }, duration);

    return () => clearTimeout(timer);
  }, [message, onClose]);

  const toneClassName =
    message.type === "success"
      ? "status-note status-note-success"
      : message.type === "error"
        ? "status-note status-note-danger"
        : "status-note status-note-accent";

  const icon =
    message.type === "success"
      ? "✓"
      : message.type === "error"
        ? "✕"
        : "ℹ";

  return (
    <div
      className={`${toneClassName} flex items-start gap-3 rounded-2xl shadow-sm`}
    >
      <span className="pt-0.5 text-sm font-semibold">{icon}</span>
      <span className="text-sm leading-6">{message.message}</span>
    </div>
  );
}

interface ToastContainerProps {
  readonly toasts: readonly ToastMessage[];
  readonly onClose: (id: string) => void;
}

export function ToastContainer({
  toasts,
  onClose,
}: ToastContainerProps): React.ReactElement {
  return (
    <div className="fixed right-4 top-4 z-50 max-w-md space-y-2">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast}
          onClose={onClose}
        />
      ))}
    </div>
  );
}

export function useToast(): {
  readonly toasts: readonly ToastMessage[];
  readonly addToast: (
    type: "success" | "error" | "info",
    message: string,
    duration?: number
  ) => void;
  readonly removeToast: (id: string) => void;
} {
  const [toasts, setToasts] = useState<readonly ToastMessage[]>([]);

  const addToast = (
    type: "success" | "error" | "info",
    message: string,
    duration?: number
  ): void => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [
      ...prev,
      { id, type, message, duration: duration || 5000 },
    ]);
  };

  const removeToast = (id: string): void => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  return { toasts, addToast, removeToast };
}
