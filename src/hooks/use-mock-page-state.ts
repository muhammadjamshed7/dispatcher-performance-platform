"use client";

import { useCallback, useEffect, useState } from "react";

import type { PageContentState } from "@/components/feedback/page-content-gate";

type UseMockPageStateOptions = {
  isEmpty: boolean;
  loadDelayMs?: number;
  resetKey?: string | number;
};

export function useMockPageState({
  isEmpty,
  loadDelayMs = 450,
  resetKey,
}: UseMockPageStateOptions) {
  const [retryCount, setRetryCount] = useState(0);
  const [isError, setIsError] = useState(false);
  const [readyKey, setReadyKey] = useState<string | null>(null);

  const loadKey = `${resetKey ?? "default"}-${loadDelayMs}-${retryCount}`;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setReadyKey(loadKey);
    }, loadDelayMs);

    return () => window.clearTimeout(timer);
  }, [loadKey, loadDelayMs]);

  const isReady = readyKey === loadKey;

  const state: PageContentState = isError
    ? "error"
    : !isReady
      ? "loading"
      : isEmpty
        ? "empty"
        : "ready";

  const retry = useCallback(() => {
    setIsError(false);
    setRetryCount((count) => count + 1);
  }, []);

  const setError = useCallback(() => {
    setIsError(true);
  }, []);

  return { state, retry, setError };
}
