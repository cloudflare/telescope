import { spawnSync } from 'child_process';
import { describe, beforeAll, expect, it } from 'vitest';

import { retrieveConfig, cleanupTestDirectory } from './helpers.js';
import type { SavedConfig } from '../src/types.js';

describe('CLI: no arguments shows help', () => {
  let stdout: string;
  let stderr: string;
  let status: number | null;

  beforeAll(() => {
    const output = spawnSync('node', ['dist/src/cli.js']);
    stdout = output.stdout.toString();
    stderr = output.stderr.toString();
    status = output.status;
  });

  it('exits with code 0', () => {
    expect(status).toBe(0);
  });

  it('prints usage to stdout', () => {
    expect(stdout).toMatch(/Usage:\s+telescope/);
  });

  it('lists the --url option in help', () => {
    expect(stdout).toContain('--url');
  });

  it('does not write anything to stderr', () => {
    expect(stderr).toBe('');
  });
});

describe('CLI: positional URL argument', () => {
  let config: SavedConfig | null = null;
  let testId: string | undefined;

  beforeAll(() => {
    try {
      const args = [
        'node',
        'dist/src/cli.js',
        '--dry',
        'https://www.example.com',
      ];
      const output = spawnSync(args[0], args.slice(1));
      const outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
        config = retrieveConfig(testId);
      }
    } finally {
      cleanupTestDirectory(testId);
    }
  });

  it('accepts URL as a positional argument', () => {
    expect(config).toBeTruthy();
  });

  it('stores the URL in the saved config', () => {
    expect(config?.options.url).toBe('https://www.example.com');
  });
});

describe('CLI: positional URL alongside other options', () => {
  let config: SavedConfig | null = null;
  let testId: string | undefined;

  beforeAll(() => {
    try {
      const args = [
        'node',
        'dist/src/cli.js',
        'https://www.example.com',
        '--dry',
        '-b',
        'firefox',
      ];
      const output = spawnSync(args[0], args.slice(1));
      const outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
        config = retrieveConfig(testId);
      }
    } finally {
      cleanupTestDirectory(testId);
    }
  });

  it('parses positional URL and other options together', () => {
    expect(config?.options.url).toBe('https://www.example.com');
    expect(config?.options.browser).toBe('firefox');
  });
});

describe('CLI: --url flag still works for backwards compatibility', () => {
  let config: SavedConfig | null = null;
  let testId: string | undefined;

  beforeAll(() => {
    try {
      const args = [
        'node',
        'dist/src/cli.js',
        '--dry',
        '--url',
        'https://www.example.com',
      ];
      const output = spawnSync(args[0], args.slice(1));
      const outputLogs = output.stdout.toString();
      const match = outputLogs.match(/Test ID:(.*)/);
      if (match && match.length > 1) {
        testId = match[1].trim();
        config = retrieveConfig(testId);
      }
    } finally {
      cleanupTestDirectory(testId);
    }
  });

  it('accepts URL via --url flag', () => {
    expect(config?.options.url).toBe('https://www.example.com');
  });
});

describe('CLI: conflicting positional URL and --url fails', () => {
  let stderr: string;
  let status: number | null;

  beforeAll(() => {
    const args = [
      'node',
      'dist/src/cli.js',
      'https://www.example.com',
      '--url',
      'https://other.example.com',
    ];
    const output = spawnSync(args[0], args.slice(1));
    stderr = output.stderr.toString();
    status = output.status;
  });

  it('exits with a non-zero status', () => {
    expect(status).not.toBe(0);
  });

  it('reports the conflict on stderr', () => {
    expect(stderr).toMatch(/conflicting URLs/i);
  });
});

describe('CLI: options without a URL fail', () => {
  let stderr: string;
  let status: number | null;

  beforeAll(() => {
    const output = spawnSync('node', ['dist/src/cli.js', '--dry']);
    stderr = output.stderr.toString();
    status = output.status;
  });

  it('exits with a non-zero status', () => {
    expect(status).not.toBe(0);
  });

  it('reports missing URL on stderr', () => {
    expect(stderr).toMatch(/missing required URL/i);
  });
});
