/**
 * Node.js import tests — load the published `renderToHTML()` entry point in a
 * plain Node.js process (no bundler, no CSS loader, no DOM shims) via the
 * package's own `exports` map. Requires `dist/` to be built first.
 */

import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeAll, describe, expect, it } from 'vitest';

import { ROOT } from './helpers.js';

const DEMO_HAR = resolve(ROOT, 'public', 'demo.har');

function runNode(source: string) {
  return spawnSync('node', ['--input-type=module', '-e', source], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

beforeAll(() => {
  if (!existsSync(resolve(ROOT, 'dist', 'render.js'))) {
    throw new Error(
      'dist/render.js not built. Run "npm run build -w packages/waterfall" first.',
    );
  }
});

describe('@cloudflare/waterfall/render in Node.js', () => {
  it('renders an empty HAR without loaders or DOM globals', () => {
    const result = runNode(`
      import { renderToHTML } from '@cloudflare/waterfall/render';
      process.stdout.write(renderToHTML({ log: { entries: [] } }));
    `);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('No entries in HAR file.');
  });

  it('renders the demo HAR', () => {
    const result = runNode(`
      import { readFileSync } from 'node:fs';
      import { renderToHTML } from '@cloudflare/waterfall/render';
      const har = JSON.parse(readFileSync(${JSON.stringify(DEMO_HAR)}, 'utf8'));
      process.stdout.write(renderToHTML(har));
    `);

    expect(result.stderr).toBe('');
    expect(result.status).toBe(0);
    expect(result.stdout).toContain('wf-row');
  });
});
