/**
 * In-memory LRU cache for parsed R2 objects.
 *
 * Test results are immutable — once uploaded they never change — so caching
 * parsed JSON from R2 across requests within the same Worker isolate is safe.
 *
 * This avoids re-fetching and re-parsing heavy files (e.g. HAR files that can
 * be several hundred KB) when users navigate between result tabs.
 *
 * The cache is bounded by both entry count and total estimated byte size to
 * prevent unbounded memory growth.
 */

const MAX_ENTRIES = 200;
const MAX_BYTES = 50 * 1024 * 1024; // 50 MB soft limit

interface CacheEntry {
  value: unknown;
  size: number;
  lastAccess: number;
}

const cache = new Map<string, CacheEntry>();
let totalBytes = 0;

function estimateSize(value: unknown): number {
  // Fast rough estimate — JSON.stringify length × 2 for UTF-16
  // Only computed once at insertion time.
  try {
    return JSON.stringify(value).length * 2;
  } catch {
    return 1024; // fallback for non-serialisable values
  }
}

function evict(): void {
  // Evict least-recently-accessed entries until we're under limits.
  while (cache.size > MAX_ENTRIES || totalBytes > MAX_BYTES) {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;
    for (const [key, entry] of cache) {
      if (entry.lastAccess < oldestTime) {
        oldestTime = entry.lastAccess;
        oldestKey = key;
      }
    }
    if (oldestKey) {
      const entry = cache.get(oldestKey)!;
      totalBytes -= entry.size;
      cache.delete(oldestKey);
    } else {
      break;
    }
  }
}

/**
 * Get a parsed JSON value from the cache.
 * Returns `undefined` on cache miss.
 */
export function getCached<T>(key: string): T | undefined {
  const entry = cache.get(key);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.value as T;
  }
  return undefined;
}

/**
 * Store a parsed JSON value in the cache.
 */
export function setCached(key: string, value: unknown): void {
  // If already cached, remove old entry's size contribution first
  const existing = cache.get(key);
  if (existing) {
    totalBytes -= existing.size;
  }

  const size = estimateSize(value);
  cache.set(key, { value, size, lastAccess: Date.now() });
  totalBytes += size;
  evict();
}

/**
 * Check whether an R2 key is known to exist (from a prior .get() or .head()).
 * Returns `undefined` if we don't know.
 */
export function getExistsCached(key: string): boolean | undefined {
  const entry = cache.get(`__exists__${key}`);
  if (entry) {
    entry.lastAccess = Date.now();
    return entry.value as boolean;
  }
  return undefined;
}

/**
 * Record whether an R2 key exists. Tiny entries (just a boolean).
 */
export function setExistsCached(key: string, exists: boolean): void {
  const cacheKey = `__exists__${key}`;
  const existing = cache.get(cacheKey);
  if (existing) {
    totalBytes -= existing.size;
  }
  const size = 64; // boolean + key overhead
  cache.set(cacheKey, { value: exists, size, lastAccess: Date.now() });
  totalBytes += size;
  // No evict needed for tiny entries but keep it safe
  evict();
}

/**
 * Fetch a JSON file from R2, using the cache for deduplication.
 *
 * Returns `null` if the object doesn't exist.
 * Caches both the parsed result and the existence flag.
 */
export async function getR2Json<T>(
  bucket: any,
  key: string,
): Promise<T | null> {
  // Check cache first
  const cached = getCached<T>(key);
  if (cached !== undefined) {
    return cached;
  }

  // Check if we already know it doesn't exist
  const exists = getExistsCached(key);
  if (exists === false) {
    return null;
  }

  try {
    const obj = await bucket.get(key);
    if (!obj) {
      setExistsCached(key, false);
      return null;
    }
    setExistsCached(key, true);
    const parsed = (await obj.json()) as T;
    setCached(key, parsed);
    return parsed;
  } catch (err) {
    console.error(`Error reading ${key} from R2:`, err);
    return null;
  }
}

/**
 * Check if an R2 object exists, using the cache.
 * Uses .head() which is cheaper than .get().
 */
export async function r2Exists(bucket: any, key: string): Promise<boolean> {
  const cached = getExistsCached(key);
  if (cached !== undefined) {
    return cached;
  }

  // If we already have the full object cached, it exists
  if (getCached(key) !== undefined) {
    return true;
  }

  try {
    const obj = await bucket.head(key);
    const exists = obj !== null;
    setExistsCached(key, exists);
    return exists;
  } catch {
    return false;
  }
}
