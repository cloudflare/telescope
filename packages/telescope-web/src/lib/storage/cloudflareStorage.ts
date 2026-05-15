/**
 * CloudflareStorage — R2-backed implementation of IStorage.
 *
 * Wraps `env.RESULTS_BUCKET` from the Cloudflare Workers runtime.
 * Used when TELESCOPE_MODE=cloudflare (default).
 *
 * IMPORTANT: This module imports from `cloudflare:workers`, which only
 * resolves inside the Workers runtime. It must be loaded via dynamic
 * import from the storage factory so it never executes in local mode.
 */

import { env } from 'cloudflare:workers';

import type { IStorage } from './storage.js';

export class CloudflareStorage implements IStorage {
  private get bucket() {
    const bucket = env.RESULTS_BUCKET;
    if (!bucket) {
      throw new Error(
        'RESULTS_BUCKET binding is not configured for this environment.',
      );
    }
    return bucket;
  }

  private key(testId: string, filename: string): string {
    return `${testId}/${filename}`;
  }

  async get(testId: string, filename: string): Promise<Uint8Array | null> {
    const obj = await this.bucket.get(this.key(testId, filename));
    if (!obj) return null;
    return new Uint8Array(await obj.arrayBuffer());
  }

  async getJSON<T>(testId: string, filename: string): Promise<T | null> {
    const obj = await this.bucket.get(this.key(testId, filename));
    if (!obj) return null;
    try {
      return await obj.json<T>();
    } catch (error) {
      console.error(
        `[CloudflareStorage] JSON parse error: ${this.key(testId, filename)}`,
        error,
      );
      return null;
    }
  }

  async put(
    testId: string,
    filename: string,
    data: Uint8Array,
  ): Promise<void> {
    await this.bucket.put(this.key(testId, filename), data);
  }

  async list(testId: string): Promise<string[]> {
    const prefix = `${testId}/`;
    const listed = await this.bucket.list({ prefix });
    return listed.objects
      .map(obj => obj.key.slice(prefix.length))
      .filter(Boolean);
  }

  async exists(testId: string, filename: string): Promise<boolean> {
    const obj = await this.bucket.head(this.key(testId, filename));
    return obj !== null;
  }
}
