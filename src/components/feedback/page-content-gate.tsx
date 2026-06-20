"use client";

import type { ReactNode } from "react";

import { EmptyState } from "@/components/feedback/empty-state";
import { ErrorState } from "@/components/feedback/error-state";
import { LoadingState } from "@/components/feedback/loading-state";

export type PageContentState = "loading" | "ready" | "empty" | "error";

type PageContentGateProps = {
  state: PageContentState;
  onRetry?: () => void;
  emptyTitle: string;
  emptyDescription: string;
  emptyActionLabel?: string;
  onEmptyAction?: () => void;
  errorTitle?: string;
  errorDescription?: string;
  loadingTitle?: string;
  children: ReactNode;
};

export function PageContentGate({
  state,
  onRetry,
  emptyTitle,
  emptyDescription,
  emptyActionLabel,
  onEmptyAction,
  errorTitle,
  errorDescription,
  loadingTitle,
  children,
}: PageContentGateProps) {
  if (state === "loading") {
    return <LoadingState title={loadingTitle} />;
  }

  if (state === "empty") {
    return (
      <EmptyState
        title={emptyTitle}
        description={emptyDescription}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }

  if (state === "error") {
    return (
      <ErrorState
        title={errorTitle}
        description={errorDescription}
        onRetry={onRetry}
      />
    );
  }

  return children;
}
