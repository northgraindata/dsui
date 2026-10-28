/** Short-lived cache that shares one in-flight load per key. */
export interface TtlCache {
  get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T>;
  clear(): void;
}

export function createTtlCache(now: () => number = Date.now): TtlCache {
  const entries = new Map<
    string,
    { expiresAt: number; value: Promise<unknown> }
  >();
  return {
    get<T>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
      const hit = entries.get(key);
      if (hit && hit.expiresAt > now()) return hit.value as Promise<T>;
      const value = load();
      const entry = { expiresAt: now() + ttlMs, value };
      entries.set(key, entry);
      // A failed load must not be served again for the rest of the TTL.
      value.catch(() => {
        if (entries.get(key) === entry) entries.delete(key);
      });
      return value;
    },
    clear() {
      entries.clear();
    },
  };
}
