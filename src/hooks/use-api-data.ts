"use client";

import { useCallback, useEffect, useState } from "react";

import { ApiClientError } from "@/lib/api/client";

type UseApiDataOptions<T> = {
  enabled?: boolean;
  initialData?: T;
};

export function useApiData<T>(
  loader: () => Promise<T>,
  deps: unknown[] = [],
  options: UseApiDataOptions<T> = {},
) {
  const { enabled = true, initialData } = options;
  const [data, setData] = useState<T | undefined>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);

  const reload = useCallback(async () => {
    if (!enabled) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const next = await loader();
      setData(next);
    } catch (err) {
      setError(
        err instanceof ApiClientError ? err.message : "Failed to load data.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [enabled, loader]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;

    queueMicrotask(() => {
      reload()
        .catch(() => undefined)
        .finally(() => {
          if (!active) {
            setIsLoading(false);
          }
        });
    });

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reload, ...deps]);

  return {
    data,
    error,
    isLoading,
    isEmpty: !isLoading && !error && Array.isArray(data) && data.length === 0,
    reload,
    setData,
  };
}
