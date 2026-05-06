/**
 * LocalStorage — filesystem-backed implementation of IStorage.
 *
 * Files live under `${RESULTS_DIR}/${testId}/${filename}`.
 * Used when TELESCOPE_MODE=local.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';

import type { IStorage } from './storage.js';
import { getResultsDir } from '@/lib/config/mode';

export class LocalStorage implements IStorage {
  private resultsDir: string;

  constructor(resultsDir?: string) {
    this.resultsDir = resultsDir ?? getResultsDir();
  }

  private filePath(testId: string, filename: string): string {
    return join(this.resultsDir, testId, filename);
  }

  async get(testId: string, filename: string): Promise<Uint8Array | null> {
    const path = this.filePath(testId, filename);
    if (!existsSync(path)) return null;
    try {
      return new Uint8Array(readFileSync(path));
    } catch (error) {
      console.error(`[LocalStorage] read error: ${path}`, error);
      return null;
    }
  }

  async getJSON<T>(testId: string, filename: string): Promise<T | null> {
    const bytes = await this.get(testId, filename);
    if (!bytes) return null;
    try {
      return JSON.parse(new TextDecoder('utf-8').decode(bytes)) as T;
    } catch (error) {
      console.error(
        `[LocalStorage] JSON parse error: ${this.filePath(testId, filename)}`,
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
    const path = this.filePath(testId, filename);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, data);
  }

  async list(testId: string): Promise<string[]> {
    const dir = join(this.resultsDir, testId);
    if (!existsSync(dir)) return [];
    return walkDir(dir, dir);
  }

  async exists(testId: string, filename: string): Promise<boolean> {
    return existsSync(this.filePath(testId, filename));
  }
}

/**
 * Recursively list all files under `dir`, returning paths relative to `base`.
 * Uses POSIX separators in the returned paths to match the R2 key format.
 */
function walkDir(dir: string, base: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      out.push(...walkDir(full, base));
    } else if (stats.isFile()) {
      const rel = relative(base, full);
      out.push(rel.split(sep).join('/'));
    }
  }
  return out;
}
