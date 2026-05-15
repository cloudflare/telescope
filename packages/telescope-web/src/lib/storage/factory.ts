/**
 * Factories for storage and test-store providers.
 *
 * Uses dynamic imports so that Cloudflare-only modules
 * (`cloudflare:workers`, Prisma D1 adapter) are never evaluated when
 * running in local mode, and `node:fs` is never bundled into the
 * Workers runtime when running in cloudflare mode.
 *
 * Each provider is cached per-process; Cloudflare Workers get a fresh
 * isolate per request anyway, so caching here is safe in both modes.
 */

import type { PrismaClient } from '@/generated/prisma/client';
import { getMode } from '@/lib/config/mode';

import type { ITestStore } from '@/lib/repositories/testStore';
import type { IStorage } from './storage.js';

let cachedStorage: IStorage | null = null;

export async function getStorage(): Promise<IStorage> {
  if (cachedStorage) return cachedStorage;
  if (getMode() === 'local') {
    const { LocalStorage } = await import('./localStorage.js');
    cachedStorage = new LocalStorage();
  } else {
    const { CloudflareStorage } = await import('./cloudflareStorage.js');
    cachedStorage = new CloudflareStorage();
  }
  return cachedStorage;
}

/**
 * Build the test-store for the current mode.
 *
 * In cloudflare mode, the caller must provide an active PrismaClient
 * (created in middleware). In local mode the prisma argument is ignored.
 */
export async function getTestStore(
  prisma?: PrismaClient | null,
): Promise<ITestStore> {
  if (getMode() === 'local') {
    const { LocalTestStore } = await import(
      '@/lib/repositories/localTestStore'
    );
    return new LocalTestStore();
  }
  if (!prisma) {
    throw new Error(
      'D1TestStore requires a PrismaClient. Did middleware run?',
    );
  }
  const { D1TestStore } = await import('@/lib/repositories/d1TestStore');
  return new D1TestStore(prisma);
}

/**
 * For tests / scripts: clear the cached storage instance so the next
 * call to `getStorage()` re-resolves the implementation.
 */
export function resetStorageCache(): void {
  cachedStorage = null;
}
