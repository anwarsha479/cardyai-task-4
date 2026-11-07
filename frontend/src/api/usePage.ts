import { useCallback, useEffect, useRef, useState } from 'react';
import { api, ApiError } from './client';

/**
 * Loads `path` whenever it changes and keeps the last result while the next one loads, so tables do
 * not flash empty between pages. Answers to older requests are ignored.
 */
export function usePage<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const latest = useRef(0);

  const reload = useCallback(() => {
    if (!path) return;
    const request = ++latest.current;
    setLoading(true);
    api<T>(path)
      .then((result) => {
        if (request !== latest.current) return;
        setData(result);
        setError(null);
      })
      .catch((err: unknown) => {
        if (request === latest.current) setError(err instanceof ApiError ? err.message : 'Could not load this list');
      })
      .finally(() => {
        if (request === latest.current) setLoading(false);
      });
  }, [path]);

  useEffect(reload, [reload]);

  return { data, error, loading, reload };
}

/** `value`, but only after it has stopped changing for `ms` (for search boxes). */
export function useDebounced<T>(value: T, ms = 300): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** `?a=1&b=x` from an object, skipping empty values. */
export function queryString(params: Record<string, string | number | boolean | null | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '' && value !== false) query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}
