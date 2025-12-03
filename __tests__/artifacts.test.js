import { launchTest } from '../index.js';
import { spawnSync } from 'child_process';
import fs from 'fs';
import path from 'path';

describe('CLI vs Programmatic artifacts', () => {
  const resultsRoot = path.resolve('results');

  function safeResultsPath(testId) {
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

  function listArtifacts(root) {
    const normalize = relative => {
      const base = path.posix.basename(relative);
      if (/^[0-9a-f]{32}\.webm$/i.test(base)) {
        const dirName = path.posix.dirname(relative);
        const normalizedDir = dirName === '.' ? '' : dirName;
        return normalizedDir
          ? `${normalizedDir}/__video__.webm`
          : '__video__.webm';
      }
      return relative;
    };

    const items = [];
    const stack = [{ dir: root, rel: '' }];

    while (stack.length) {
      const { dir, rel } = stack.pop();
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
    return items.sort();
  }

  async function runProgrammaticTest(options) {
    const result = await launchTest(options);
    if (!result.success) {
      throw new Error(`Programmatic test failed: ${result.error}`);
    }
    return path.resolve(result.resultsPath);
  }

  function runCliTest(url, browser) {
    const args = ['cli.js', '--url', url, '-b', browser];
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

  function cleanup(paths) {
    for (const p of paths) {
      if (p && fs.existsSync(p)) {
        fs.rmSync(p, { recursive: true, force: true });
      }
    }
  }

  test('produces same artifact files for CLI and programmatic API', async () => {
    const url = 'https://example.com';
    const browser = 'chrome';

    let cliPath;
    let apiPath;
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
