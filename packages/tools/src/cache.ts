export interface CacheEntry<T> {
  value: T;
  fetchedAt: string;
  expiresAt: number;
}

export interface TtlCacheOptions {
  ttlMs?: number;
  now?: () => number;
}

const DEFAULT_TTL_MS = 5 * 60_000;

export class TtlCache<T> {
  private store = new Map<string, CacheEntry<T>>();
  private readonly ttlMs: number;
  private readonly now: () => number;

  constructor(options: TtlCacheOptions = {}) {
    this.ttlMs = options.ttlMs ?? DEFAULT_TTL_MS;
    this.now = options.now ?? Date.now;
  }

  get(key: string): CacheEntry<T> | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (entry.expiresAt <= this.now()) {
      this.store.delete(key);
      return null;
    }
    return entry;
  }

  set(key: string, value: T): CacheEntry<T> {
    const now = this.now();
    const entry: CacheEntry<T> = {
      value,
      fetchedAt: new Date(now).toISOString(),
      expiresAt: now + this.ttlMs,
    };
    this.store.set(key, entry);
    return entry;
  }

  async fetchOrLoad(
    key: string,
    loader: () => Promise<T>,
  ): Promise<CacheEntry<T>> {
    const existing = this.get(key);
    if (existing) return existing;
    const value = await loader();
    return this.set(key, value);
  }

  clear() {
    this.store.clear();
  }
}
