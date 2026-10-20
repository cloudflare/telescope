import { launchTest } from '../src/index.js';
import { describe, expect, it, test, beforeAll, afterAll } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { BrowserConfig } from '../src/browsers.js';
import type { SuccessfulTestResult } from '../src/types.js';
import { retrieveConfig, cleanupTestDirectory } from './helpers.js';

const browsers = BrowserConfig.getBrowsers();

function hasVideo(resultsPath: string): boolean {
  return fs.readdirSync(resultsPath).some(f => /\.(webm|mp4)$/i.test(f));
}

describe('Recording flag: browser config', () => {
  test('recordVideo is present by default', () => {
    const config = new BrowserConfig().getBrowserConfig('chrome', {
      url: 'https://www.example.com',
    });
    expect(config.recordVideo).toBeDefined();
  });

  test('recordVideo is removed when recording is false', () => {
    const config = new BrowserConfig().getBrowserConfig('chrome', {
      url: 'https://www.example.com',
      recording: false,
    });
    expect(config.recordVideo).toBeUndefined();
  });
});

describe('Recording flag: upload validation', () => {
  it('launchTest rejects uploadUrl when recording is false', async () => {
    const result = await launchTest({
      url: 'https://www.example.com',
      recording: false,
      uploadUrl: 'https://api.example.com/upload',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toMatch(/requires recording/);
    }
  });

  it('CLI rejects --uploadUrl combined with --no-recording', () => {
    const output = spawnSync('node', [
      'dist/src/cli.js',
      '--no-recording',
      '--uploadUrl',
      'https://api.example.com/upload',
      'https://www.example.com',
    ]);
    expect(output.status).toBe(1);
    expect(output.stderr.toString()).toMatch(/requires recording/);
  });
});

describe('Recording flag: CLI config', () => {
  function readRecordingFromDryRun(args: string[]): boolean | undefined {
    let testId: string | undefined;
    try {
      const output = spawnSync('node', [
        'dist/src/cli.js',
        '--dry',
        ...args,
        'https://www.example.com',
      ]);
      const match = output.stdout.toString().match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
        return retrieveConfig(testId)?.options.recording;
      }
    } finally {
      cleanupTestDirectory(testId);
    }
  }

  it('defaults to true', () => {
    expect(readRecordingFromDryRun([])).toBe(true);
  });

  it('--no-recording sets recording to false', () => {
    expect(readRecordingFromDryRun(['--no-recording'])).toBe(false);
  });
});

describe.each(browsers)('Recording disabled (%s)', browser => {
  let result: SuccessfulTestResult;

  beforeAll(async () => {
    const testResult = await launchTest({
      url: 'https://www.example.com',
      browser,
      recording: false,
      html: true,
    });
    if (!testResult.success) throw new Error(testResult.error);
    result = testResult;
  }, 120000);

  afterAll(() => {
    if (result) cleanupTestDirectory(result.testId);
  });

  it('does not record a video', () => {
    expect(hasVideo(result.resultsPath)).toBe(false);
  });

  it('does not take a screenshot', () => {
    expect(fs.existsSync(path.join(result.resultsPath, 'screenshot.png'))).toBe(
      false,
    );
  });

  it('does not generate a filmstrip', () => {
    expect(fs.existsSync(path.join(result.resultsPath, 'filmstrip'))).toBe(
      false,
    );
  });

  it('still generates the HTML report', () => {
    expect(fs.existsSync(path.join(result.resultsPath, 'index.html'))).toBe(
      true,
    );
  });

  it('still produces the HAR and metrics', () => {
    expect(fs.existsSync(path.join(result.resultsPath, 'pageload.har'))).toBe(
      true,
    );
    expect(fs.existsSync(path.join(result.resultsPath, 'metrics.json'))).toBe(
      true,
    );
  });

  it('saves recording: false in config.json', () => {
    expect(retrieveConfig(result.testId)?.options.recording).toBe(false);
  });
});
