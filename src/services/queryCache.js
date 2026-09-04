// src/services/queryCache.js
// High-performance Stale-While-Revalidate (SWR) in-memory & persistent caching engine.
// Provides 0ms instant data retrieval, background revalidation, and in-flight request deduplication.

class QueryCacheManager {
  constructor() {
    // In-memory cache: key -> { data, timestamp, isFetching, promise }
    this.memoryCache = new Map();
    // Active promise registry for request deduplication
    this.inFlightRequests = new Map();
    // Subscriptions for cache update listeners
    this.listeners = new Map();
  }

  /**
   * Generates a normalized cache key
   */
  _normalizeKey(key) {
    if (typeof key === 'string') return key;
    return JSON.stringify(key);
  }

  /**
   * Get cached item from memory or fallback to local storage
   */
  get(key) {
    const normKey = this._normalizeKey(key);
    const item = this.memoryCache.get(normKey);
    if (item && item.data !== undefined) {
      return item;
    }

    // Try reading from localStorage as fallback
    try {
      const raw = localStorage.getItem(`qc_${normKey}`);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.data !== undefined) {
          // Warm up memory cache
          this.memoryCache.set(normKey, parsed);
          return parsed;
        }
      }
    } catch {
      // Ignore parse/storage errors
    }

    return null;
  }

  /**
   * Set data into cache with timestamp
   */
  set(key, data, persist = true) {
    const normKey = this._normalizeKey(key);
    const entry = {
      data,
      timestamp: Date.now()
    };
    this.memoryCache.set(normKey, entry);

    if (persist) {
      try {
        localStorage.setItem(`qc_${normKey}`, JSON.stringify(entry));
      } catch {
        // Quota exceeded or private browsing — fail silently
      }
    }

    // Notify listeners
    this._notify(normKey, data);
    return data;
  }

  /**
   * Invalidate a single key or all keys matching a prefix
   */
  invalidate(keyOrPrefix) {
    const normKey = this._normalizeKey(keyOrPrefix);
    
    // Clear exact match
    this.memoryCache.delete(normKey);
    try {
      localStorage.removeItem(`qc_${normKey}`);
    } catch {}

    // Clear matching prefixes
    for (const k of this.memoryCache.keys()) {
      if (k.startsWith(normKey)) {
        this.memoryCache.delete(k);
        try {
          localStorage.removeItem(`qc_${k}`);
        } catch {}
      }
    }
  }

  /**
   * Fetch with SWR (Stale-While-Revalidate) & In-flight Deduplication
   * 
   * @param {string|Array} key - Unique cache key
   * @param {Function} fetcher - Async function returning fresh data
   * @param {Object} options
   * @param {number} options.staleTime - Time in ms before data is considered stale (default 2 mins)
   * @param {number} options.cacheTime - Max TTL in ms (default 30 mins)
   * @param {boolean} options.forceRefresh - Bypass cache and fetch fresh
   * @param {boolean} options.persist - Persist to localStorage
   * @param {Function} options.onBackgroundUpdate - Callback when fresh background data arrives
   */
  async fetchWithCache(key, fetcher, options = {}) {
    const {
      staleTime = 1000 * 60 * 3, // 3 minutes stale time
      cacheTime = 1000 * 60 * 30, // 30 minutes total TTL
      forceRefresh = false,
      persist = true,
      onBackgroundUpdate = null
    } = options;

    const normKey = this._normalizeKey(key);
    const cached = this.get(normKey);
    const now = Date.now();

    // 1. If we have fresh cached data and not forcing refresh, return immediately (0ms)
    if (!forceRefresh && cached && (now - cached.timestamp) < staleTime) {
      return cached.data;
    }

    // 2. If data exists but is stale, return stale data immediately and revalidate in background (SWR)
    if (!forceRefresh && cached && (now - cached.timestamp) < cacheTime) {
      // Trigger background revalidation if not already in-flight
      this._revalidateInBackground(normKey, fetcher, persist, onBackgroundUpdate);
      return cached.data;
    }

    // 3. Otherwise (no cache or expired or forced refresh), deduplicate and await fetcher
    return this._deduplicatedFetch(normKey, fetcher, persist);
  }

  /**
   * Revalidates data in background and invokes callback if changed
   */
  _revalidateInBackground(normKey, fetcher, persist, callback) {
    if (this.inFlightRequests.has(normKey)) return;

    this._deduplicatedFetch(normKey, fetcher, persist)
      .then(freshData => {
        if (callback && typeof callback === 'function') {
          callback(freshData);
        }
      })
      .catch(err => {
        console.warn(`[QueryCache] Background revalidation failed for '${normKey}':`, err);
      });
  }

  /**
   * Deduplicates concurrent promises for identical queries
   */
  async _deduplicatedFetch(normKey, fetcher, persist) {
    if (this.inFlightRequests.has(normKey)) {
      return this.inFlightRequests.get(normKey);
    }

    const promise = (async () => {
      try {
        const freshData = await fetcher();
        if (freshData !== undefined && freshData !== null) {
          this.set(normKey, freshData, persist);
        }
        return freshData;
      } finally {
        this.inFlightRequests.delete(normKey);
      }
    })();

    this.inFlightRequests.set(normKey, promise);
    return promise;
  }

  /**
   * Subscribe to cache updates
   */
  subscribe(key, listener) {
    const normKey = this._normalizeKey(key);
    if (!this.listeners.has(normKey)) {
      this.listeners.set(normKey, new Set());
    }
    this.listeners.get(normKey).add(listener);

    return () => {
      const set = this.listeners.get(normKey);
      if (set) {
        set.delete(listener);
        if (set.size === 0) this.listeners.delete(normKey);
      }
    };
  }

  _notify(normKey, data) {
    const set = this.listeners.get(normKey);
    if (set) {
      set.forEach(listener => {
        try { listener(data); } catch (e) { console.warn(e); }
      });
    }
  }

  /**
   * Clear all cached queries
   */
  clearAll() {
    this.memoryCache.clear();
    this.inFlightRequests.clear();
    try {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('qc_')) {
          keysToRemove.push(k);
        }
      }
      keysToRemove.forEach(k => localStorage.removeItem(k));
    } catch {}
  }
}

export const queryCache = new QueryCacheManager();
export default queryCache;
