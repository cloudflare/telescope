import { spawnSync } from 'child_process';
import { describe, beforeAll, expect, it } from 'vitest';

import { retrieveConfig, cleanupTestDirectory } from './helpers.js';
import { normalizeUrlScheme, isHttpUrl } from '../src/helpers.js';
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

describe('CLI: URL provided both positionally and via --url fails', () => {
  describe('different values', () => {
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

    it('reports the duplicate on stderr', () => {
      expect(stderr).toMatch(/provided both as a positional argument/i);
    });
  });

  describe('identical values', () => {
    let stderr: string;
    let status: number | null;

    beforeAll(() => {
      const args = [
        'node',
        'dist/src/cli.js',
        'https://www.example.com',
        '--url',
        'https://www.example.com',
      ];
      const output = spawnSync(args[0], args.slice(1));
      stderr = output.stderr.toString();
      status = output.status;
    });

    it('exits with a non-zero status', () => {
      expect(status).not.toBe(0);
    });

    it('reports the duplicate on stderr', () => {
      expect(stderr).toMatch(/provided both as a positional argument/i);
    });
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

describe('normalizeUrlScheme()', () => {
  it('prepends https:// when no scheme is present', () => {
    expect(normalizeUrlScheme('example.com')).toBe('https://example.com');
  });

  it('preserves paths and query strings when prepending', () => {
    expect(normalizeUrlScheme('example.com/path?x=1')).toBe(
      'https://example.com/path?x=1',
    );
  });

  it('leaves https:// URLs unchanged', () => {
    expect(normalizeUrlScheme('https://example.com')).toBe(
      'https://example.com',
    );
  });

  it('leaves http:// URLs unchanged (does not upgrade)', () => {
    expect(normalizeUrlScheme('http://example.com')).toBe('http://example.com');
  });

  it('handles uppercase http(s) schemes', () => {
    expect(normalizeUrlScheme('HTTPS://example.com')).toBe(
      'HTTPS://example.com',
    );
  });

  it('preserves fragments (e.g. SPA routes)', () => {
    expect(normalizeUrlScheme('example.com/#/dashboard')).toBe(
      'https://example.com/#/dashboard',
    );
  });

  describe('localhost http:// default', () => {
    it.each([
      ['localhost', 'http://localhost'],
      ['localhost:3000', 'http://localhost:3000'],
      ['localhost/path?x=1', 'http://localhost/path?x=1'],
      ['LOCALHOST:3000', 'http://LOCALHOST:3000'],
      ['app.localhost', 'http://app.localhost'],
      ['my-app.localhost:8080', 'http://my-app.localhost:8080'],
      ['127.0.0.1', 'http://127.0.0.1'],
      ['127.0.0.1:8080', 'http://127.0.0.1:8080'],
      ['127.1.2.3', 'http://127.1.2.3'],
    ])('defaults %s to http://', (input, expected) => {
      expect(normalizeUrlScheme(input)).toBe(expected);
    });

    it('keeps explicit https://localhost unchanged', () => {
      expect(normalizeUrlScheme('https://localhost:3000')).toBe(
        'https://localhost:3000',
      );
    });

    it('does not match localhost-lookalike hostnames', () => {
      // `localhostlookalike.com` starts with `localhost` but is a different
      // host -- it should get https:// like any other public hostname.
      expect(normalizeUrlScheme('localhostlookalike.com')).toBe(
        'https://localhostlookalike.com',
      );
    });

    it('does not treat 0.0.0.0 as localhost', () => {
      expect(normalizeUrlScheme('0.0.0.0:8080')).toBe('https://0.0.0.0:8080');
    });

    it('does not treat private LAN ranges as localhost', () => {
      expect(normalizeUrlScheme('192.168.1.10:8080')).toBe(
        'https://192.168.1.10:8080',
      );
      expect(normalizeUrlScheme('10.0.0.5')).toBe('https://10.0.0.5');
    });
  });

  it.each([
    ['ftp://example.com'],
    ['file:///tmp/page.html'],
    ['about:blank'],
    ['data:text/html,<h1>hi</h1>'],
    ['mailto:user@example.com'],
    ['tel:+15555550123'],
    ['javascript:alert(1)'],
  ])('rejects non-http(s) URL %s', input => {
    expect(() => normalizeUrlScheme(input)).toThrow(
      /Only http:\/\/ and https:\/\/ URLs are supported/,
    );
  });
});

describe('isHttpUrl()', () => {
  it.each([
    ['http://example.com', true],
    ['https://example.com', true],
    ['HTTPS://example.com', true],
    ['ftp://example.com', false],
    ['file:///tmp/page.html', false],
    ['about:blank', false],
    ['example.com', false],
    ['localhost:3000', false],
  ])('isHttpUrl(%s) === %s', (input, expected) => {
    expect(isHttpUrl(input)).toBe(expected);
  });
});

describe('CLI: positional URL without scheme is normalized to https://', () => {
  let config: SavedConfig | null = null;
  let testId: string | undefined;

  beforeAll(() => {
    try {
      const args = ['node', 'dist/src/cli.js', '--dry', 'www.example.com'];
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

  it('saves the URL with https:// prepended', () => {
    expect(config?.options.url).toBe('https://www.example.com');
  });
});

describe('CLI: --url without scheme is also normalized', () => {
  let config: SavedConfig | null = null;
  let testId: string | undefined;

  beforeAll(() => {
    try {
      const args = [
        'node',
        'dist/src/cli.js',
        '--dry',
        '--url',
        'www.example.com',
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

  it('saves the URL with https:// prepended', () => {
    expect(config?.options.url).toBe('https://www.example.com');
  });
});

describe.each([
  ['ftp://example.com'],
  ['file:///tmp/page.html'],
  ['about:blank'],
])('CLI: rejects non-http(s) URL %s', input => {
  let stderr: string;
  let status: number | null;

  beforeAll(() => {
    const output = spawnSync('node', ['dist/src/cli.js', '--dry', input]);
    stderr = output.stderr.toString();
    status = output.status;
  });

  it('exits with a non-zero status', () => {
    expect(status).not.toBe(0);
  });

  it('reports the http(s)-only restriction on stderr', () => {
    expect(stderr).toMatch(/Only http:\/\/ and https:\/\/ URLs are supported/);
  });
});
