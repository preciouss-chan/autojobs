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

  const bgColor =
    message.type === "success"
      ? "bg-green-500"
      : message.type === "error"
        ? "bg-red-500"
        : "bg-blue-500";

  const icon =
    message.type === "success"
      ? "✓"
      : message.type === "error"
        ? "✕"
        : "ℹ";

  return (
    <div
      className={`${bgColor} text-white px-4 py-3 rounded-lg shadow-lg flex items-center gap-3 animate-in slide-in-from-top fade-in`}
    >
      <span className="font-bold text-lg">{icon}</span>
      <span>{message.message}</span>
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
    <div className="fixed top-4 right-4 z-50 space-y-2 max-w-md">
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
