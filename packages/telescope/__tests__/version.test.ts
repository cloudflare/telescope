import { spawnSync } from 'child_process';
import { readFileSync } from 'fs';
import path from 'path';
import url from 'url';

import { describe, it, expect, beforeAll } from 'vitest';

const currentDir = path.dirname(url.fileURLToPath(import.meta.url));
const packageRoot = path.resolve(currentDir, '..');
const cliPath = path.resolve(packageRoot, 'dist', 'src', 'cli.js');
const packageJsonPath = path.resolve(packageRoot, 'package.json');

interface PackageJson {
  version: string;
}

describe('Version flag', () => {
  let expectedVersion: string;

  beforeAll(() => {
    const pkg = JSON.parse(
      readFileSync(packageJsonPath, 'utf8'),
    ) as PackageJson;
    expectedVersion = pkg.version;
  });

  it.each(['--version', '-v'])(
    'prints the package version and exits 0 for %s',
    flag => {
      const result = spawnSync('node', [cliPath, flag], { encoding: 'utf8' });

      expect(result.status).toBe(0);
      expect(result.stdout.trim()).toBe(expectedVersion);
      expect(result.stderr).toBe('');
    },
  );

  it('matches semver format', () => {
    const result = spawnSync('node', [cliPath, '--version'], {
      encoding: 'utf8',
    });

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toMatch(/^\d+\.\d+\.\d+(?:[-+].+)?$/);
  });

  it('does not require --url when a version flag is provided', () => {
    // The version flag must short-circuit parsing before Commander enforces
    // the required --url option.
    const result = spawnSync('node', [cliPath, '-v'], { encoding: 'utf8' });

    expect(result.status).toBe(0);
    expect(result.stderr).not.toContain('required option');
  });
});
