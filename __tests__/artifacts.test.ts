import { launchTest } from '../src/index.js';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { BrowserConfig } from '../src/browsers.js';
import { expect } from '@playwright/test';
import type { LaunchOptions, SuccessfulTestResult } from '../src/types.js';

const browsers = BrowserConfig.getBrowsers();
const resultsRoot = path.resolve('results');

function safeResultsPath(testId: string | undefined): string {
  if (!testId) {
    throw new Error('Invalid test id');
  }
  const normalized = path.normalize(testId).replace(/^(\.\.(\/|\\|$))+/, '');
  const fullPath = path.resolve(resultsRoot, normalized);
  if (!fullPath.startsWith(resultsRoot)) {
    throw new Error('Unsafe results path');
  }
  return fullPath;
}

function listArtifacts(root: string): string[] {
  const normalize = (relative: string): string => {
    const base = path.posix.basename(relative);
    const parent = path.posix.basename(path.posix.dirname(relative));

    // make sure webm (screen recording) file names are ignored when comparing artifacts
    if (/\.webm$/i.test(base)) {
      const dirName = path.posix.dirname(relative);
      const normalizedDir = dirName === '.' ? '' : dirName;
      return normalizedDir
        ? `${normalizedDir}/__video__.webm`
        : '__video__.webm';
    }

    // make sure filmstrip screenshots are counted as one to avoid discrepancies because of timing
    if (parent === 'filmstrip' && /\.jpg$/i.test(base)) {
      const dirName = path.posix.dirname(relative);
      const normalizedDir = dirName === '.' ? '' : dirName;
      return normalizedDir ? `${normalizedDir}/__image__.jpg` : '__image__.jpg';
    }
    return relative;
  };

  const items: string[] = [];
  const stack: Array<{ dir: string; rel: string }> = [{ dir: root, rel: '' }];

  while (stack.length) {
    const item = stack.pop();
    if (!item) continue;
    const { dir, rel } = item;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const absolute = path.join(dir, entry.name);
      const relative = path.posix.join(rel, entry.name);
      if (entry.isDirectory()) {
        stack.push({ dir: absolute, rel: relative });
      } else {
        items.push(normalize(relative));
      }
    }
  }
  return [...new Set(items)].sort();
}

async function runProgrammaticTest(options: LaunchOptions): Promise<string> {
  const result = await launchTest(options);
  if (!result.success) {
    throw new Error(`Programmatic test failed: ${result.error}`);
  }
  return path.resolve((result as SuccessfulTestResult).resultsPath);
}

function runCliTest(url: string, browser: string): string {
  const args = ['dist/src/cli.js', '--url', url, '-b', browser];
  const output = spawnSync('node', args, { encoding: 'utf-8' });
  if (output.status !== 0) {
    throw new Error(`CLI test failed: ${output.stderr || output.stdout}`);
  }
  const match = output.stdout.match(/Test ID:(.*)/);
  if (!match || match.length < 2) {
    throw new Error('Unable to extract Test ID from CLI output');
  }
  return safeResultsPath(match[1].trim());
}

function cleanup(paths: Array<string | undefined>): void {
  for (const p of paths) {
    if (p && fs.existsSync(p)) {
      fs.rmSync(p, { recursive: true, force: true });
    }
  }
}

describe.each(browsers)('CLI vs Programmatic artifacts (%s)', browser => {
  test('produces same artifact files for CLI and programmatic API', async () => {
    const url = 'https://example.com';

    let cliPath: string | undefined;
    let apiPath: string | undefined;
    try {
      cliPath = runCliTest(url, browser);
      apiPath = await runProgrammaticTest({ url, browser });

      const cliArtifacts = listArtifacts(cliPath);
      const apiArtifacts = listArtifacts(apiPath);

      // Compare file structure only (same files exist), not content (non-deterministic)
      expect(apiArtifacts).toEqual(cliArtifacts);
    } finally {
      cleanup([cliPath, apiPath]);
    }
  }, 120000);
});

describe.each(browsers)('Generated HTML artifacts (%s)', browser => {
  test('produces html when --html is specified.', async () => {
    let result: Awaited<ReturnType<typeof launchTest>> | undefined;
    try {
      result = await launchTest({
        url: 'https://www.example.com/',
        html: true,
        browser: browser,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success) {
        const indexPath = path.resolve(result.resultsPath, 'index.html');
        expect(fs.existsSync(indexPath)).toBe(true);
      }
    } finally {
      if (!process.env.CI && result?.success) {
        cleanup([path.resolve((result as SuccessfulTestResult).resultsPath)]);
      }
    }
  }, 120000);
});

describe.each(browsers)('Generated list artifacts (%s)', browser => {
  test('produces the list page when --list is specified.', async () => {
    let result: Awaited<ReturnType<typeof launchTest>> | undefined;
    let indexPath: string | undefined;
    try {
      result = await launchTest({
        url: 'https://www.example.com/',
        list: true,
        browser: browser,
      });

      expect(result).toBeDefined();
      expect(result.success).toBe(true);
      if (result.success) {
        indexPath = path.resolve(
          (result as SuccessfulTestResult).resultsPath,
          '..',
          'index.html',
        );
        expect(fs.existsSync(indexPath)).toBe(true);
      }
    } finally {
      if (!process.env.CI && result?.success) {
        cleanup([
          path.resolve((result as SuccessfulTestResult).resultsPath),
          indexPath,
        ]);
      }
    }
  }, 120000);
});
