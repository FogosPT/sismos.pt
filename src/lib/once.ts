/**
 * Runs `fn` at most once at a time and remembers its result: concurrent
 * callers share the same promise; a failure is forgotten so the next call
 * retries.
 */
export function onceAsync<T>(fn: () => Promise<T>): () => Promise<T> {
  let pending: Promise<T> | null = null;
  return () => {
    pending ??= fn().catch((e) => {
      pending = null;
      throw e;
    });
    return pending;
  };
}
