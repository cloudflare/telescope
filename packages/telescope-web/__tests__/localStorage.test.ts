import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  existsSync,
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { LocalStorage } from '@/lib/storage/localStorage';

describe('LocalStorage', () => {
  let dir: string;
  let storage: LocalStorage;
  const testId = '2026_01_15_10_30_00_test-uuid-1234';

  beforeEach(() => {
    dir = join(tmpdir(), `telescope-localstorage-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(dir, { recursive: true });
    storage = new LocalStorage(dir);
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('returns null for missing files', async () => {
    expect(await storage.get(testId, 'config.json')).toBeNull();
    expect(await storage.exists(testId, 'config.json')).toBe(false);
    expect(await storage.list(testId)).toEqual([]);
  });

  it('writes and reads bytes', async () => {
    const data = new TextEncoder().encode('hello world');
    await storage.put(testId, 'data.bin', data);
    const read = await storage.get(testId, 'data.bin');
    expect(read).not.toBeNull();
    expect(new TextDecoder().decode(read!)).toBe('hello world');
    expect(await storage.exists(testId, 'data.bin')).toBe(true);
  });

  it('writes and reads JSON', async () => {
    const obj = { url: 'https://example.com', count: 42 };
    await storage.put(
      testId,
      'config.json',
      new TextEncoder().encode(JSON.stringify(obj)),
    );
    const read = await storage.getJSON<typeof obj>(testId, 'config.json');
    expect(read).toEqual(obj);
  });

  it('returns null when JSON is invalid', async () => {
    await storage.put(
      testId,
      'broken.json',
      new TextEncoder().encode('{ not json'),
    );
    expect(await storage.getJSON(testId, 'broken.json')).toBeNull();
  });

  it('lists files including nested filmstrip frames', async () => {
    await storage.put(testId, 'config.json', new TextEncoder().encode('{}'));
    await storage.put(testId, 'metrics.json', new TextEncoder().encode('{}'));
    await storage.put(
      testId,
      'filmstrip/frame_001.jpg',
      new TextEncoder().encode('jpg'),
    );
    await storage.put(
      testId,
      'filmstrip/frame_002.jpg',
      new TextEncoder().encode('jpg'),
    );
    const list = (await storage.list(testId)).sort();
    expect(list).toEqual([
      'config.json',
      'filmstrip/frame_001.jpg',
      'filmstrip/frame_002.jpg',
      'metrics.json',
    ]);
  });

  it('creates parent directories on put', async () => {
    await storage.put(
      testId,
      'deep/nested/file.txt',
      new TextEncoder().encode('x'),
    );
    expect(existsSync(join(dir, testId, 'deep', 'nested', 'file.txt'))).toBe(
      true,
    );
  });

  it('reads pre-existing files written outside the storage layer', async () => {
    const target = join(dir, testId);
    mkdirSync(target, { recursive: true });
    writeFileSync(join(target, 'pageload.har'), '{"har":true}');
    const json = await storage.getJSON<{ har: boolean }>(
      testId,
      'pageload.har',
    );
    expect(json).toEqual({ har: true });
  });
});
