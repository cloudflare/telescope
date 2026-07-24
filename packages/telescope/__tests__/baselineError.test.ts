import fs from 'node:fs';
import path from 'node:path';

import { expect, test, vi } from 'vitest';

const { runBaselinePipelineMock } = vi.hoisted(() => ({
  runBaselinePipelineMock: vi.fn(),
}));

vi.mock('../src/baseline.js', () => ({
  runBaselinePipeline: runBaselinePipelineMock,
}));

import { BrowserConfig } from '../src/browsers.js';
import { launchTest } from '../src/index.js';
import { cleanupTestDirectory } from './helpers.js';

test('a baseline pipeline error is logged without failing the performance test', async () => {
  const error = new Error('artifact write failed');
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  runBaselinePipelineMock.mockImplementationOnce(
    ({ resultsPath }: { resultsPath: string }) => {
      expect(fs.existsSync(path.join(resultsPath, 'pageload.har'))).toBe(true);
      expect(fs.existsSync(path.join(resultsPath, 'metrics.json'))).toBe(true);
      return Promise.reject(error);
    },
  );
  let testId: string | undefined;

  try {
    const result = await launchTest({
      baseline: true,
      browser: BrowserConfig.getBrowsers()[0],
      url: 'https://example.com',
    });

    expect(result.success).toBe(true);
    if (!result.success) {
      throw new Error(result.error);
    }
    testId = result.testId;
    expect(errorSpy).toHaveBeenCalledWith('Baseline pipeline error: ' + error);
  } finally {
    errorSpy.mockRestore();
    cleanupTestDirectory(testId);
  }
}, 60000);
