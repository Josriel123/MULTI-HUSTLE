'use client';

import { useCallback, useEffect, useState } from 'react';

/**
 * Loads data for a key (usually the tax year) and reloads on demand.
 *
 * `loading` is derived, never set: it is true until the response for the
 * current key has landed. While a new key loads, the previous data stays on
 * screen (wrap it in <Busy>), so figures dim instead of vanishing. A response
 * for a key that is no longer current is dropped, so a slow request for 2025
 * can never overwrite the 2026 figures that replaced it.
 *
 * `load` must be stable for a given key: wrap it in useCallback.
 */
export function useLoad<T>(key: string, load: () => Promise<T>) {
  const [result, setResult] = useState<{ key: string; data: T | null; error: unknown } | null>(null);

  useEffect(() => {
    let ignore = false;
    load().then(
      (data) => {
        if (!ignore) setResult({ key, data, error: null });
      },
      (error: unknown) => {
        if (ignore) return;
        console.error(`Failed to load (${key})`, error);
        setResult((prev) => ({ key, data: prev?.data ?? null, error }));
      },
    );
    return () => {
      ignore = true;
    };
  }, [key, load]);

  /** Fetch again for the current key, e.g. after a save. Resolves once the new data is in. */
  const reload = useCallback(async () => {
    try {
      const data = await load();
      setResult({ key, data, error: null });
    } catch (error) {
      console.error(`Failed to reload (${key})`, error);
      setResult((prev) => ({ key, data: prev?.data ?? null, error }));
    }
  }, [key, load]);

  return {
    data: result?.data ?? null,
    error: result?.error ?? null,
    loading: result?.key !== key,
    reload,
  };
}
