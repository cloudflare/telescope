/**
 * Integration test for the upload API route in local mode.
 *
 * Drives the POST handler directly with a synthesised ZIP and a fake
 * Astro APIContext whose locals are wired to a LocalStorage +
 * LocalTestStore pointed at a tmp directory.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { zipSync } from 'fflate';

import { POST } from '@/pages/api/upload';
import { LocalStorage } from '@/lib/storage/localStorage';
import { LocalTestStore } from '@/lib/repositories/localTestStore';
import type { ITestStore } from '@/lib/repositories/testStore';

interface ZipConfig {
  url: string;
  date: string;
  options: { url: string; browser?: string };
  browserConfig: { engine: string };
}

function buildZip(
  config: ZipConfig,
  extra: Record<string, Uint8Array> = {},
): Uint8Array {
  return zipSync({
    'config.json': new TextEncoder().encode(JSON.stringify(config)),
    'metrics.json': new TextEncoder().encode('{}'),
    'console.json': new TextEncoder().encode('[]'),
    'resources.json': new TextEncoder().encode('[]'),
    'pageload.har': new TextEncoder().encode('{"log":{}}'),
    'screenshot.png': new Uint8Array([0x89, 0x50, 0x4e, 0x47]),
    ...extra,
  });
}

function zipFile(zip: Uint8Array, name = 'test.zip'): File {
  // Copy into a fresh ArrayBuffer so the File constructor's BlobPart
  // type accepts it (Uint8Array<ArrayBufferLike> isn't assignable directly).
  const buf = new ArrayBuffer(zip.byteLength);
  new Uint8Array(buf).set(zip);
  return new File([buf], name, { type: 'application/zip' });
}

function makeContext(opts: {
  formData: FormData;
  storage: LocalStorage;
  testStore: ITestStore;
}): unknown {
  return {
    request: new Request('http://localhost/api/upload', {
      method: 'POST',
      body: opts.formData,
    }),
    locals: {
      mode: 'local',
      storage: opts.storage,
      testStore: opts.testStore,
      prisma: null,
    },
  };
}

describe('POST /api/upload (local mode)', () => {
  let dir: string;
  let storage: LocalStorage;
  let store: ITestStore;

  beforeEach(() => {
    dir = join(
      tmpdir(),
      `telescope-upload-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(dir, { recursive: true });
    storage = new LocalStorage(dir);
    store = new LocalTestStore(dir);
  });

  afterEach(() => {
    if (existsSync(dir)) rmSync(dir, { recursive: true, force: true });
  });

  it('writes uploaded files to the local results directory', async () => {
    const zip = buildZip({
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com', browser: 'chrome' },
      browserConfig: { engine: 'chromium' },
    });
    const form = new FormData();
    form.append('file', zipFile(zip));
    form.append('source', 'upload');
    form.append('name', 'My Upload');
    form.append('description', 'Pushed through the upload route');

    const ctx = makeContext({ formData: form, storage, testStore: store });
    // The route signature accepts APIContext; cast through unknown for tests.
    const res = await POST(ctx as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { success: boolean; testId: string };
    expect(body.success).toBe(true);
    expect(body.testId).toMatch(/^\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_/);

    // Verify all expected files landed under tmp/{testId}/
    const testDir = join(dir, body.testId);
    expect(existsSync(testDir)).toBe(true);
    expect(existsSync(join(testDir, 'config.json'))).toBe(true);
    expect(existsSync(join(testDir, 'metrics.json'))).toBe(true);
    expect(existsSync(join(testDir, 'pageload.har'))).toBe(true);
    expect(existsSync(join(testDir, 'screenshot.png'))).toBe(true);
  });

  it('persists name/description into config.json', async () => {
    const zip = buildZip({
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com', browser: 'chrome' },
      browserConfig: { engine: 'chromium' },
    });
    const form = new FormData();
    form.append('file', zipFile(zip));
    form.append('source', 'upload');
    form.append('name', 'Named Run');
    form.append('description', 'Should appear in config.json');

    const ctx = makeContext({ formData: form, storage, testStore: store });
    const res = await POST(ctx as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { testId: string };

    const configBytes = readFileSync(
      join(dir, body.testId, 'config.json'),
      'utf-8',
    );
    const config = JSON.parse(configBytes);
    expect(config.name).toBe('Named Run');
    expect(config.description).toBe('Should appear in config.json');
    // Original config fields should still be there
    expect(config.url).toBe('https://example.com');
    expect(config.browserConfig.engine).toBe('chromium');
  });

  it('omits name/description from config.json when not provided', async () => {
    const zip = buildZip({
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com', browser: 'chrome' },
      browserConfig: { engine: 'chromium' },
    });
    const form = new FormData();
    form.append('file', zipFile(zip));
    form.append('source', 'upload');

    const ctx = makeContext({ formData: form, storage, testStore: store });
    const res = await POST(ctx as never);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { testId: string };
    const config = JSON.parse(
      readFileSync(join(dir, body.testId, 'config.json'), 'utf-8'),
    );
    expect(config.name).toBeUndefined();
    expect(config.description).toBeUndefined();
  });

  it('returns 409 when the same testId folder already exists', async () => {
    // Build a zip with a fixed date so generateTestId yields the same prefix.
    // generateTestId still appends a random UUID, so we simulate the dedupe by
    // pre-creating the folder once via a successful upload, then re-uploading
    // a zip with a config date that produces a colliding folder name.
    //
    // To force the collision deterministically, we mkdir a folder using the
    // same testId returned by the first upload before sending the second.
    const zip = buildZip({
      url: 'https://example.com',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'https://example.com' },
      browserConfig: { engine: 'chromium' },
    });
    const firstForm = new FormData();
    firstForm.append('file', zipFile(zip));
    firstForm.append('source', 'upload');
    const firstRes = await POST(
      makeContext({ formData: firstForm, storage, testStore: store }) as never,
    );
    const firstBody = (await firstRes.json()) as { testId: string };

    // Simulate a folder collision by reusing the same testId in a separate
    // upload attempt: pre-create the folder and craft a second zip whose
    // config date generates a different ID, then symlink — actually simplest
    // is to ensure the existing test is detected. Re-running the same zip
    // produces a *new* testId (different UUID), so we instead mimic the
    // duplicate scenario by writing the new test folder ourselves to match
    // what the second upload's generated testId will be. This requires
    // patching the testStore.findByTestId to claim the test exists.
    const dupStore: ITestStore = {
      ...store,
      getAll: store.getAll.bind(store),
      getById: store.getById.bind(store),
      getRating: store.getRating.bind(store),
      create: store.create.bind(store),
      findByZipKey: store.findByZipKey.bind(store),
      updateContentRating: store.updateContentRating.bind(store),
      findByTestId: async () => ({
        testId: firstBody.testId,
        contentRating: 'safe',
      }),
    };
    const secondForm = new FormData();
    secondForm.append('file', zipFile(zip));
    secondForm.append('source', 'upload');
    const dupRes = await POST(
      makeContext({
        formData: secondForm,
        storage,
        testStore: dupStore,
      }) as never,
    );
    expect(dupRes.status).toBe(409);
    const dupBody = (await dupRes.json()) as {
      success: boolean;
      testId: string;
    };
    expect(dupBody.success).toBe(false);
    expect(dupBody.testId).toBe(firstBody.testId);
  });

  it('rejects ZIP without a config.json', async () => {
    const zip = zipSync({
      'metrics.json': new TextEncoder().encode('{}'),
    });
    const form = new FormData();
    form.append('file', zipFile(zip));
    form.append('source', 'upload');
    const res = await POST(
      makeContext({ formData: form, storage, testStore: store }) as never,
    );
    expect(res.status).toBe(400);
  });

  it('rejects ZIP with invalid URL in config.json', async () => {
    const zip = buildZip({
      url: 'not-a-url',
      date: 'Wed, 15 Jan 2026 10:30:00 GMT',
      options: { url: 'not-a-url' },
      browserConfig: { engine: 'chromium' },
    });
    const form = new FormData();
    form.append('file', zipFile(zip));
    form.append('source', 'upload');
    const res = await POST(
      makeContext({ formData: form, storage, testStore: store }) as never,
    );
    expect(res.status).toBe(400);
  });
});
