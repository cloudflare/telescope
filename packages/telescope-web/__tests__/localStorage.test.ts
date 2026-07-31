import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

import { afterAll, describe, expect, it } from 'vitest';

import {
  createTest,
  findTestIdByZipKey,
  getAllTests,
  getTestById,
} from '@/lib/repositories/testRepository';
import { createLocalRuntimeServices } from '@/lib/runtime/node';
import { TestSource } from '@/lib/types/tests';

describe('local persistence', () => {
  const dataDirectory = mkdtempSync(path.join(tmpdir(), 'telescope-web-'));
  const services = createLocalRuntimeServices(dataDirectory);

  afterAll(() => {
    rmSync(dataDirectory, { recursive: true, force: true });
  });

  it('stores and retrieves test metadata in SQLite', async () => {
    await createTest(services.tests, {
      testId: '2026_07_31_12_00_00_abc123',
      zipKey: 'archive-hash',
      name: 'Local test',
      description: 'Stored without an external database',
      source: TestSource.UPLOAD,
      url: 'https://example.com',
      testDate: 1_775_000_000,
      browser: 'chrome',
    });

    await expect(
      findTestIdByZipKey(services.tests, 'archive-hash'),
    ).resolves.toEqual({
      testId: '2026_07_31_12_00_00_abc123',
      contentRating: 'unknown',
    });
    await expect(
      getTestById(services.tests, '2026_07_31_12_00_00_abc123'),
    ).resolves.toMatchObject({ name: 'Local test', browser: 'chrome' });
    await expect(getAllTests(services.tests, false)).resolves.toHaveLength(1);
  });

  it('stores nested artifacts on the local filesystem', async () => {
    const testId = '2026_07_31_12_00_00_def456';
    await services.results.put(
      `${testId}/config.json`,
      new TextEncoder().encode('{"url":"https://example.com"}'),
    );
    await services.results.put(
      `${testId}/filmstrip/frame_1.jpg`,
      new Uint8Array([1, 2, 3]),
    );

    await expect(services.results.has(`${testId}/config.json`)).resolves.toBe(
      true,
    );
    await expect(
      (await services.results.get(`${testId}/config.json`))?.json(),
    ).resolves.toEqual({ url: 'https://example.com' });
    expect(
      new Uint8Array(
        (await services.results.get(`${testId}/filmstrip/frame_1.jpg`))
          ?.body as ArrayBuffer,
      ),
    ).toEqual(new Uint8Array([1, 2, 3]));
    await expect(services.results.list(`${testId}/`)).resolves.toEqual([
      `${testId}/config.json`,
      `${testId}/filmstrip/frame_1.jpg`,
    ]);
  });

  it('rejects filesystem traversal keys', async () => {
    await expect(
      services.results.put('../outside.txt', new Uint8Array([1])),
    ).rejects.toThrow('Invalid result storage key');
  });
});
