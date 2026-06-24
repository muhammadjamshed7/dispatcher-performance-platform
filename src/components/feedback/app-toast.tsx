"use client";

import { useEffect } from "react";

import { cn } from "@/lib/utils";

type AppToastProps = {
  message: string | null;
  onDismiss: () => void;
};

export function AppToast({ message, onDismiss }: AppToastProps) {
  useEffect(() => {
    if (!message) {
      return;
    }

    const timer = window.setTimeout(onDismiss, 4000);
    return () => window.clearTimeout(timer);
  }, [message, onDismiss]);

  if (!message) {
    return null;
  }

  return (
    <div
      className={cn(
        "bg-card fixed right-4 bottom-4 z-50 max-w-sm rounded-lg border px-4 py-3 text-sm shadow-lg",
      )}
      role="status"
    >
      {message}
    </div>
  );
}
