import fs from 'node:fs';
import path from 'node:path';
import type { Server } from 'node:http';

import { afterAll, beforeAll, describe, expect, test } from 'vitest';

import {
  BASELINE_SCHEMA_VERSION,
  runBaselinePipeline,
  writeBaselineArtifact,
} from '../src/baseline.js';
import { BrowserConfig } from '../src/browsers.js';
import { launchTest } from '../src/index.js';
import type { BrowserName } from '../src/types.js';
import { cleanupTestDirectory } from './helpers.js';
import {
  createStaticServer,
  fixturesDir,
  listenServer,
  shutdownServer,
} from './testServer.js';

const browsers: BrowserName[] = BrowserConfig.getBrowsers();
const packageVersion = (
  JSON.parse(fs.readFileSync(path.resolve('package.json'), 'utf8')) as {
    version: string;
  }
).version;
let baseUrl: string;
let server: Server;

beforeAll(async () => {
  server = createStaticServer({ fixturesDirPath: fixturesDir('delay') });
  baseUrl = await listenServer(server);
});

afterAll(async () => {
  await shutdownServer(server);
});

describe.each(browsers)('Baseline pipeline artifacts (%s)', browser => {
  test.each([
    ['enabled', true, true],
    ['disabled', false, false],
    ['omitted', undefined, false],
  ])(
    'writes artifacts when baseline is %s',
    async (_case, baseline, enabled) => {
      const result = await launchTest({
        baseline,
        browser,
        url: `${baseUrl}/index.html`,
      });
      if (!result.success) throw new Error(result.error);
      try {
        const baselinePath = path.join(result.resultsPath, 'baseline');
        expect(fs.existsSync(baselinePath)).toBe(enabled);
        if (enabled) {
          expect(fs.existsSync(path.join(baselinePath, 'meta.json'))).toBe(
            true,
          );
        }
      } finally {
        cleanupTestDirectory(result.testId);
      }
    },
    60000,
  );
});

test('the pipeline writes a run manifest and isolates performance artifacts', async () => {
  fs.mkdirSync(path.resolve('results'), { recursive: true });
  const resultsPath = fs.mkdtempSync(
    path.join(process.cwd(), 'results', 'baseline-isolation-'),
  );
  const harPath = path.join(resultsPath, 'pageload.har');
  const metricsPath = path.join(resultsPath, 'metrics.json');
  const har = '{"log":{"entries":[]}}';
  const metrics = '{"firstContentfulPaint":123}';
  fs.writeFileSync(harPath, har);
  fs.writeFileSync(metricsPath, metrics);

  try {
    await runBaselinePipeline({
      resultsPath,
      url: 'https://example.com',
    });

    const meta = JSON.parse(
      fs.readFileSync(path.join(resultsPath, 'baseline', 'meta.json'), 'utf8'),
    ) as Record<string, unknown>;
    expect(meta).toEqual({
      schemaVersion: BASELINE_SCHEMA_VERSION,
      telescopeVersion: packageVersion,
      timestamp: expect.any(String),
      url: 'https://example.com',
    });
    expect(new Date(meta.timestamp as string).toISOString()).toBe(
      meta.timestamp,
    );
    expect(fs.readFileSync(harPath, 'utf8')).toBe(har);
    expect(fs.readFileSync(metricsPath, 'utf8')).toBe(metrics);
  } finally {
    fs.rmSync(resultsPath, { recursive: true, force: true });
  }
});

test('writeBaselineArtifact round-trips content and blocks path escapes', () => {
  fs.mkdirSync(path.resolve('results'), { recursive: true });
  const resultsPath = fs.mkdtempSync(
    path.join(process.cwd(), 'results', 'baseline-artifact-'),
  );

  try {
    const artifact = { detected: ['grid', 'flexbox'] };
    writeBaselineArtifact(resultsPath, 'detection/example.json', artifact);

    const written = JSON.parse(
      fs.readFileSync(
        path.join(resultsPath, 'baseline', 'detection', 'example.json'),
        'utf8',
      ),
    ) as unknown;
    expect(written).toEqual(artifact);

    expect(() =>
      writeBaselineArtifact(resultsPath, '../outside.json', {}),
    ).toThrow('Invalid baseline artifact path');
  } finally {
    fs.rmSync(resultsPath, { recursive: true, force: true });
  }
});
