// src/services/queryCache.js
// ─────────────────────────────────────────────────────────────────────────────
// High-Performance 3-Layer Cache Engine: Memory → IndexedDB → localStorage
// Features: SWR, In-flight deduplication, Smart TTL tiers, Prefetch API,
//           Cache versioning, Auto-eviction, Cross-tab sync via BroadcastChannel
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_VERSION = 3; // Bump to wipe stale caches on schema changes
const IDB_DB_NAME   = 'lconq_cache_v' + CACHE_VERSION;
const IDB_STORE     = 'queries';

// ── Smart TTL Tiers (ms) ─────────────────────────────────────────────────────
const TTL = {
  // Data that almost never changes
  STATIC:  1000 * 60 * 60 * 24,  // 24 hours
  // Lessons/exams: change only on admin action
  CONTENT: 1000 * 60 * 10,       // 10 minutes stale, 2 hours cache
  CONTENT_MAX: 1000 * 60 * 120,
  // Classes/students: might change more often
  DYNAMIC: 1000 * 60 * 5,        // 5 minutes stale, 30 minutes cache
  DYNAMIC_MAX: 1000 * 60 * 30,
  // User-specific data
  USER:    1000 * 60 * 2,        // 2 minutes stale, 15 minutes cache
  USER_MAX: 1000 * 60 * 15,
  // Real-time data (leaderboard, activity)
  LIVE:    1000 * 30,            // 30 seconds stale
  LIVE_MAX: 1000 * 60 * 5,
};

// Auto-detect TTL tier from cache key
const detectTTL = (key) => {
  if (key.startsWith('lesson')) return { staleTime: TTL.CONTENT,  cacheTime: TTL.CONTENT_MAX };
  if (key.startsWith('exam'))   return { staleTime: TTL.CONTENT,  cacheTime: TTL.CONTENT_MAX };
  if (key.startsWith('class'))  return { staleTime: TTL.DYNAMIC,  cacheTime: TTL.DYNAMIC_MAX };
  if (key.startsWith('user'))   return { staleTime: TTL.USER,     cacheTime: TTL.USER_MAX };
  if (key.startsWith('leader')) return { staleTime: TTL.LIVE,     cacheTime: TTL.LIVE_MAX };
  if (key.startsWith('school')) return { staleTime: TTL.STATIC,   cacheTime: TTL.STATIC };
  return { staleTime: TTL.DYNAMIC, cacheTime: TTL.DYNAMIC_MAX };
};

// ── IndexedDB Adapter ─────────────────────────────────────────────────────────
class IDBAdapter {
  constructor() {
    this._db = null;
    this._ready = null;
    this._supported = typeof indexedDB !== 'undefined';
  }

  _open() {
    if (this._ready) return this._ready;
    if (!this._supported) return Promise.resolve(null);

    this._ready = new Promise((resolve) => {
      try {
        const req = indexedDB.open(IDB_DB_NAME, 1);
        req.onupgradeneeded = (e) => {
          const db = e.target.result;
          if (!db.objectStoreNames.contains(IDB_STORE)) {
            db.createObjectStore(IDB_STORE, { keyPath: 'key' });
          }
        };
        req.onsuccess  = (e) => { this._db = e.target.result; resolve(this._db); };
        req.onerror    = ()  => { this._supported = false; resolve(null); };
        req.onblocked  = ()  => { this._supported = false; resolve(null); };
      } catch {
        this._supported = false;
        resolve(null);
      }
    });
    return this._ready;
  }

  async get(key) {
    const db = await this._open();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx   = db.transaction(IDB_STORE, 'readonly');
        const req  = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = () => resolve(req.result || null);
        req.onerror   = () => resolve(null);
      } catch { resolve(null); }
    });
  }

  async set(key, entry) {
    const db = await this._open();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx  = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put({ key, ...entry });
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
      } catch { resolve(); }
    });
  }

  async delete(key) {
    const db = await this._open();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx  = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
      } catch { resolve(); }
    });
  }

  async getAllKeys() {
    const db = await this._open();
    if (!db) return [];
    return new Promise((resolve) => {
      try {
        const tx   = db.transaction(IDB_STORE, 'readonly');
        const req  = tx.objectStore(IDB_STORE).getAllKeys();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror   = () => resolve([]);
      } catch { resolve([]); }
    });
  }

  async clear() {
    const db = await this._open();
    if (!db) return;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).clear();
        tx.oncomplete = () => resolve();
        tx.onerror    = () => resolve();
      } catch { resolve(); }
    });
  }
}

// ── localStorage Helpers (for small metadata only) ───────────────────────────
const LS_PREFIX = 'qc_';
const lsGet = (key) => {
  try {
    const raw = localStorage.getItem(LS_PREFIX + key);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
};
const lsSet = (key, entry) => {
  try {
    localStorage.setItem(LS_PREFIX + key, JSON.stringify(entry));
  } catch { /* Quota exceeded — ignore, IDB is primary */ }
};
const lsDelete = (key) => {
  try { localStorage.removeItem(LS_PREFIX + key); } catch {}
};

// ── QueryCacheManager ─────────────────────────────────────────────────────────
class QueryCacheManager {
  constructor() {
    /** @type {Map<string, {data: any, timestamp: number}>} */
    this.memoryCache = new Map();
    /** @type {Map<string, Promise<any>>} */
    this.inFlightRequests = new Map();
    /** @type {Map<string, Set<Function>>} */
    this.listeners = new Map();
    /** @type {Map<string, Promise<void>>} */
    this._pendingIdbWrites = new Map();

    this.idb = new IDBAdapter();

    // Cross-tab cache invalidation via BroadcastChannel
    this._channel = null;
    if (typeof BroadcastChannel !== 'undefined') {
      try {
        this._channel = new BroadcastChannel('lconq_cache');
        this._channel.onmessage = (e) => {
          if (e.data?.type === 'INVALIDATE') {
            this._localInvalidate(e.data.key);
          }
        };
      } catch {}
    }
  }

  _normalizeKey(key) {
    return typeof key === 'string' ? key : JSON.stringify(key);
  }

  // ── Read ─────────────────────────────────────────────────────────────────

  /** Synchronous memory-only read (0ms). Returns null if not in memory. */
  getSync(key) {
    const normKey = this._normalizeKey(key);
    return this.memoryCache.get(normKey) || null;
  }

  /**
   * Full read: memory → IndexedDB → localStorage.
   * Returns { data, timestamp } or null.
   */
  async get(key) {
    const normKey = this._normalizeKey(key);

    // 1. Memory (0ms)
    const mem = this.memoryCache.get(normKey);
    if (mem?.data !== undefined) return mem;

    // 2. IndexedDB (async, persistent, large capacity)
    const idbEntry = await this.idb.get(normKey);
    if (idbEntry?.data !== undefined) {
      this.memoryCache.set(normKey, { data: idbEntry.data, timestamp: idbEntry.timestamp });
      return idbEntry;
    }

    // 3. localStorage fallback (for tiny metadata)
    const lsEntry = lsGet(normKey);
    if (lsEntry?.data !== undefined) {
      this.memoryCache.set(normKey, lsEntry);
      return lsEntry;
    }

    return null;
  }

  // ── Write ────────────────────────────────────────────────────────────────

  /**
   * Set data in all cache layers.
   * Large data (arrays > 5 items or strings > 10KB) → IDB only.
   * Small data → IDB + localStorage (for instant cold-start reads).
   */
  set(key, data, persist = true) {
    const normKey = this._normalizeKey(key);
    const entry   = { data, timestamp: Date.now() };

    // Layer 1: memory (sync)
    this.memoryCache.set(normKey, entry);

    if (persist) {
      const isLarge = Array.isArray(data)
        ? data.length > 5
        : typeof data === 'string'
          ? data.length > 10_000
          : false;

      // Layer 2: IndexedDB (fire-and-forget, non-blocking)
      this.idb.set(normKey, entry).catch(() => {});

      // Layer 3: localStorage for small data only (instant warm-up on next load)
      if (!isLarge) {
        lsSet(normKey, entry);
      }
    }

    this._notify(normKey, data);
    return data;
  }

  // ── Invalidate ───────────────────────────────────────────────────────────

  /** Invalidate locally and broadcast to other tabs. */
  invalidate(keyOrPrefix) {
    const normKey = this._normalizeKey(keyOrPrefix);
    this._localInvalidate(normKey);

    // Notify other tabs
    try { this._channel?.postMessage({ type: 'INVALIDATE', key: normKey }); } catch {}
  }

  /** Internal invalidation (no broadcast, also handles prefix matching). */
  _localInvalidate(normKey) {
    // Exact key
    this.memoryCache.delete(normKey);
    lsDelete(normKey);
    this.idb.delete(normKey).catch(() => {});

    // Prefix-based sweep on memory cache
    for (const k of this.memoryCache.keys()) {
      if (k !== normKey && k.startsWith(normKey)) {
        this.memoryCache.delete(k);
        lsDelete(k);
        this.idb.delete(k).catch(() => {});
      }
    }
  }

  // ── SWR Core ─────────────────────────────────────────────────────────────

  /**
   * Fetch with Stale-While-Revalidate + deduplication.
   * Auto-detects TTL tier from cache key if not specified.
   *
   * @param {string|Array} key
   * @param {() => Promise<any>} fetcher
   * @param {Object} [options]
   * @param {number}   [options.staleTime]
   * @param {number}   [options.cacheTime]
   * @param {boolean}  [options.forceRefresh]
   * @param {boolean}  [options.persist]
   * @param {Function} [options.onBackgroundUpdate]
   */
  async fetchWithCache(key, fetcher, options = {}) {
    const normKey = this._normalizeKey(key);
    const auto    = detectTTL(normKey);
    const {
      staleTime         = auto.staleTime,
      cacheTime         = auto.cacheTime,
      forceRefresh      = false,
      persist           = true,
      onBackgroundUpdate = null,
    } = options;

    const now    = Date.now();
    const cached = await this.get(normKey);
    const isEmptyArray = cached && Array.isArray(cached.data) && cached.data.length === 0;

    // ── Fresh cache → return immediately (0ms) ──────────────────────────
    if (!forceRefresh && cached && !isEmptyArray && (now - cached.timestamp) < staleTime) {
      return cached.data;
    }

    // ── Stale cache → return stale immediately + revalidate in background
    if (!forceRefresh && cached && !isEmptyArray && (now - cached.timestamp) < cacheTime) {
      this._revalidateInBackground(normKey, fetcher, persist, onBackgroundUpdate);
      return cached.data;
    }

    // ── No cache / expired / forced → deduplicated fetch ───────────────
    return this._deduplicatedFetch(normKey, fetcher, persist);
  }

  _revalidateInBackground(normKey, fetcher, persist, callback) {
    if (this.inFlightRequests.has(normKey)) return;
    this._deduplicatedFetch(normKey, fetcher, persist)
      .then(fresh => { if (callback) callback(fresh); })
      .catch(err  => console.warn(`[Cache] BG revalidation failed '${normKey}':`, err));
  }

  async _deduplicatedFetch(normKey, fetcher, persist) {
    if (this.inFlightRequests.has(normKey)) {
      return this.inFlightRequests.get(normKey);
    }

    const promise = (async () => {
      try {
        const fresh = await fetcher();
        if (fresh !== undefined && fresh !== null) {
          this.set(normKey, fresh, persist);
        }
        return fresh;
      } finally {
        this.inFlightRequests.delete(normKey);
      }
    })();

    this.inFlightRequests.set(normKey, promise);
    return promise;
  }

  // ── Prefetch API ─────────────────────────────────────────────────────────

  /**
   * Prefetch data into cache without blocking the caller.
   * Safe to call multiple times — deduplicates automatically.
   */
  prefetch(key, fetcher, options = {}) {
    const normKey = this._normalizeKey(key);
    const cached  = this.getSync(normKey);
    const auto    = detectTTL(normKey);
    const stale   = options.staleTime ?? auto.staleTime;

    // Already fresh — skip
    if (cached && (Date.now() - cached.timestamp) < stale) return;
    // Already loading — skip
    if (this.inFlightRequests.has(normKey)) return;

    this.fetchWithCache(key, fetcher, { ...options, persist: true })
      .catch(err => console.warn(`[Cache] Prefetch failed '${normKey}':`, err));
  }

  // ── Subscriptions ─────────────────────────────────────────────────────────

  subscribe(key, listener) {
    const normKey = this._normalizeKey(key);
    if (!this.listeners.has(normKey)) this.listeners.set(normKey, new Set());
    this.listeners.get(normKey).add(listener);
    return () => {
      const s = this.listeners.get(normKey);
      if (s) { s.delete(listener); if (!s.size) this.listeners.delete(normKey); }
    };
  }

  _notify(normKey, data) {
    this.listeners.get(normKey)?.forEach(fn => {
      try { fn(data); } catch {}
    });
  }

  // ── Maintenance ──────────────────────────────────────────────────────────

  /** Warm the memory cache from IDB on app startup (call once). */
  async warmUp(keys) {
    const warmKeys = keys || [];
    await Promise.all(warmKeys.map(k => this.get(k)));
  }

  /** Evict expired entries from IDB to prevent unbounded growth. */
  async evictExpired(maxAgeMs = TTL.STATIC) {
    try {
      const allKeys = await this.idb.getAllKeys();
      const cutoff  = Date.now() - maxAgeMs;
      await Promise.all(
        allKeys.map(async (k) => {
          const entry = await this.idb.get(k);
          if (entry && entry.timestamp < cutoff) {
            this.idb.delete(k);
            lsDelete(k);
          }
        })
      );
    } catch {}
  }

  /** Clear everything. */
  async clearAll() {
    this.memoryCache.clear();
    this.inFlightRequests.clear();
    await this.idb.clear().catch(() => {});
    try {
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k?.startsWith(LS_PREFIX)) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}

export const queryCache = new QueryCacheManager();
export { TTL };
export default queryCache;
