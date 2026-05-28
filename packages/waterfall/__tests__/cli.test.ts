/**
 * CLI tests — exercise `dist/cli.js` end-to-end via `spawnSync`.
 *
 * The CLI is built before the tests run (vitest runs from the package root,
 * so `dist/cli.js` is expected to exist — run `npm run build` first or rely
 * on the `npm run test:telescope` style workflow).
 */

import { spawnSync, type SpawnSyncReturns } from 'node:child_process';
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ROOT } from './helpers.js';

const CLI = resolve(ROOT, 'dist', 'cli.js');
const DEMO_HAR = resolve(ROOT, 'public', 'demo.har');

let workDir: string;

/**
 * Run the CLI with the given args inside `workDir`. Returns the raw
 * `SpawnSyncReturns<string>` so tests can assert on exit code, stdout, stderr.
 */
function runCli(args: string[]): SpawnSyncReturns<string> {
  return spawnSync('node', [CLI, ...args], {
    cwd: workDir,
    encoding: 'utf8',
  });
}

beforeAll(() => {
  if (!existsSync(CLI)) {
    throw new Error(
      `CLI not built at ${CLI}. Run "npm run build -w packages/waterfall" first.`,
    );
  }
  if (!existsSync(DEMO_HAR)) {
    throw new Error(`Demo HAR not found at ${DEMO_HAR}.`);
  }
});

beforeEach(() => {
  workDir = mkdtempSync(resolve(tmpdir(), 'waterfall-cli-test-'));
});

afterEach(() => {
  rmSync(workDir, { recursive: true, force: true });
});

// ─────────────────────────────────────────────────────────────────────────────
// Help / usage
// ─────────────────────────────────────────────────────────────────────────────

describe('CLI: help and usage', () => {
  it('--help prints usage and exits 0', () => {
    const r = runCli(['--help']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage: npx @cloudflare\/waterfall/);
    expect(r.stdout).toMatch(/--attr/);
    expect(r.stdout).toMatch(/--no-js/);
  });

  it('-h prints usage and exits 0', () => {
    const r = runCli(['-h']);
    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Usage: npx @cloudflare\/waterfall/);
  });

  it('exits non-zero with usage when no args are provided', () => {
    const r = runCli([]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/expected 1 or 2 positional arguments, got 0/);
    expect(r.stderr).toMatch(/Usage:/);
  });

  it('exits non-zero when given too many positional args', () => {
    const r = runCli(['a.har', 'b.html', 'c.html']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/expected 1 or 2 positional arguments, got 3/);
  });

  it('rejects unknown options', () => {
    const r = runCli(['--bogus', 'demo.har']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/unknown option: --bogus/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// File errors
// ─────────────────────────────────────────────────────────────────────────────

describe('CLI: file errors', () => {
  it('errors when the input HAR does not exist', () => {
    const r = runCli(['missing.har', 'out.html']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/could not read HAR file/);
  });

  it('errors when the input HAR is not valid JSON', () => {
    const bad = resolve(workDir, 'bad.har');
    // Write invalid JSON via spawnSync helper
    spawnSync('sh', ['-c', `echo 'not json {' > '${bad}'`]);
    const r = runCli(['bad.har', 'out.html']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/failed to parse HAR JSON/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Pre-render (default) mode
// ─────────────────────────────────────────────────────────────────────────────

describe('CLI: pre-render mode (default)', () => {
  function copyDemoHar(name = 'demo.har'): string {
    const dst = resolve(workDir, name);
    spawnSync('cp', [DEMO_HAR, dst]);
    return dst;
  }

  it('writes HTML and copies CSS/JS assets', () => {
    copyDemoHar();
    const r = runCli(['demo.har', 'out.html']);

    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/Wrote .*out\.html/);

    const html = readFileSync(resolve(workDir, 'out.html'), 'utf8');
    expect(html).toMatch(/<!doctype html>/i);
    expect(html).toMatch(
      /<link rel="stylesheet" href="waterfall\/waterfall\.css"/,
    );
    expect(html).toMatch(
      /<script type="module" src="waterfall\/waterfall\.js"><\/script>/,
    );
    // Pre-rendered content present (rows and toolbar)
    expect(html).toMatch(/<waterfall-chart>/);
    expect(html).toMatch(/class="wf-toolbar"/);
    expect(html).toMatch(/class="wf-row/);

    // Assets copied
    expect(existsSync(resolve(workDir, 'waterfall', 'waterfall.css'))).toBe(
      true,
    );
    expect(existsSync(resolve(workDir, 'waterfall', 'waterfall.js'))).toBe(
      true,
    );

    // HAR not copied in default mode
    expect(existsSync(resolve(workDir, 'out.har'))).toBe(false);
  });

  it('derives output name from HAR name when only one arg is given', () => {
    copyDemoHar('trace.har');
    const r = runCli(['trace.har']);

    expect(r.status).toBe(0);
    expect(existsSync(resolve(workDir, 'trace.html'))).toBe(true);
    const html = readFileSync(resolve(workDir, 'trace.html'), 'utf8');
    expect(html).toMatch(/<waterfall-chart>/);
  });

  it('treats .HAR (uppercase) extension when deriving output name', () => {
    copyDemoHar('Trace.HAR');
    const r = runCli(['Trace.HAR']);

    expect(r.status).toBe(0);
    expect(existsSync(resolve(workDir, 'Trace.html'))).toBe(true);
  });

  it('appends .html for input files without a .har extension', () => {
    copyDemoHar('no-ext');
    const r = runCli(['no-ext']);

    expect(r.status).toBe(0);
    expect(existsSync(resolve(workDir, 'no-ext.html'))).toBe(true);
  });

  it('creates the output directory if it does not exist', () => {
    copyDemoHar();
    const r = runCli(['demo.har', 'nested/dir/out.html']);

    expect(r.status).toBe(0);
    expect(existsSync(resolve(workDir, 'nested', 'dir', 'out.html'))).toBe(
      true,
    );
    expect(
      existsSync(
        resolve(workDir, 'nested', 'dir', 'waterfall', 'waterfall.css'),
      ),
    ).toBe(true);
  });

  it('accepts absolute paths for input and output', () => {
    const inputAbs = copyDemoHar();
    const outputAbs = resolve(workDir, 'abs.html');
    const r = runCli([inputAbs, outputAbs]);

    expect(r.status).toBe(0);
    expect(existsSync(outputAbs)).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --attr mode
// ─────────────────────────────────────────────────────────────────────────────

describe('CLI: --attr mode', () => {
  function copyDemoHar(name = 'demo.har'): string {
    const dst = resolve(workDir, name);
    spawnSync('cp', [DEMO_HAR, dst]);
    return dst;
  }

  it('emits an empty <waterfall-chart src="…"> instead of pre-rendered content', () => {
    copyDemoHar();
    const r = runCli(['--attr', 'demo.har', 'out.html']);

    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(/HAR copied as demo\.har/);

    const html = readFileSync(resolve(workDir, 'out.html'), 'utf8');
    expect(html).toMatch(
      /<waterfall-chart src="demo\.har"><\/waterfall-chart>/,
    );
    // No pre-rendered toolbar or rows in attr mode
    expect(html).not.toMatch(/class="wf-toolbar"/);
    expect(html).not.toMatch(/class="wf-row/);

    // Assets still copied
    expect(existsSync(resolve(workDir, 'waterfall', 'waterfall.css'))).toBe(
      true,
    );
    expect(existsSync(resolve(workDir, 'waterfall', 'waterfall.js'))).toBe(
      true,
    );
  });

  it('copies the HAR next to the output HTML', () => {
    copyDemoHar('source.har');
    const r = runCli(['--attr', 'source.har', 'page.html']);

    expect(r.status).toBe(0);
    expect(existsSync(resolve(workDir, 'source.har'))).toBe(true);

    const html = readFileSync(resolve(workDir, 'page.html'), 'utf8');
    expect(html).toMatch(/src="source\.har"/);
  });

  it('copies the HAR even when the input is in a different directory', () => {
    // Input HAR lives outside workDir; output goes to a subdir inside workDir.
    const outDir = resolve(workDir, 'site');
    const r = runCli(['--attr', DEMO_HAR, resolve(outDir, 'index.html')]);

    expect(r.status).toBe(0);
    // HAR should be copied next to the output HTML, using its basename
    expect(existsSync(resolve(outDir, 'demo.har'))).toBe(true);

    const html = readFileSync(resolve(outDir, 'index.html'), 'utf8');
    expect(html).toMatch(/<waterfall-chart src="demo\.har">/);

    // Original input HAR untouched
    expect(existsSync(DEMO_HAR)).toBe(true);
  });

  it('does not require valid HAR JSON because parsing is deferred to the browser', () => {
    // Write invalid JSON — --attr should still succeed (we just copy bytes).
    const bad = resolve(workDir, 'invalid.har');
    spawnSync('sh', ['-c', `echo 'not json {' > '${bad}'`]);
    const r = runCli(['--attr', 'invalid.har']);

    expect(r.status).toBe(0);
    expect(existsSync(resolve(workDir, 'invalid.html'))).toBe(true);
    expect(existsSync(resolve(workDir, 'invalid.har'))).toBe(true);
  });

  it('--attr works with derived output name', () => {
    copyDemoHar('trace.har');
    const r = runCli(['--attr', 'trace.har']);

    expect(r.status).toBe(0);
    expect(existsSync(resolve(workDir, 'trace.html'))).toBe(true);
    const html = readFileSync(resolve(workDir, 'trace.html'), 'utf8');
    expect(html).toMatch(/src="trace\.har"/);
  });

  it('accepts --attr before or after positional args', () => {
    copyDemoHar();
    const r1 = runCli(['--attr', 'demo.har', 'a.html']);
    const r2 = runCli(['demo.har', 'b.html', '--attr']);

    expect(r1.status).toBe(0);
    expect(r2.status).toBe(0);

    const htmlA = readFileSync(resolve(workDir, 'a.html'), 'utf8');
    const htmlB = readFileSync(resolve(workDir, 'b.html'), 'utf8');
    expect(htmlA).toMatch(/<waterfall-chart src="demo\.har">/);
    expect(htmlB).toMatch(/<waterfall-chart src="demo\.har">/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// --no-js mode
// ─────────────────────────────────────────────────────────────────────────────

describe('CLI: --no-js mode', () => {
  function copyDemoHar(name = 'demo.har'): string {
    const dst = resolve(workDir, name);
    spawnSync('cp', [DEMO_HAR, dst]);
    return dst;
  }

  it('omits the <script> tag and does not copy waterfall.js', () => {
    copyDemoHar();
    const r = runCli(['--no-js', 'demo.har', 'out.html']);

    expect(r.status).toBe(0);

    const html = readFileSync(resolve(workDir, 'out.html'), 'utf8');
    expect(html).not.toMatch(/<script/);
    expect(html).not.toMatch(/waterfall\/waterfall\.js/);

    // Stylesheet still referenced and copied
    expect(html).toMatch(
      /<link rel="stylesheet" href="waterfall\/waterfall\.css"/,
    );
    expect(existsSync(resolve(workDir, 'waterfall', 'waterfall.css'))).toBe(
      true,
    );

    // JS asset NOT copied
    expect(existsSync(resolve(workDir, 'waterfall', 'waterfall.js'))).toBe(
      false,
    );

    // Pre-rendered content still present (static mode renders fine with CSS only)
    expect(html).toMatch(/<waterfall-chart>/);
    expect(html).toMatch(/class="wf-toolbar"/);
    expect(html).toMatch(/class="wf-row/);
  });

  it('works with derived output name', () => {
    copyDemoHar('trace.har');
    const r = runCli(['--no-js', 'trace.har']);

    expect(r.status).toBe(0);
    expect(existsSync(resolve(workDir, 'trace.html'))).toBe(true);

    const html = readFileSync(resolve(workDir, 'trace.html'), 'utf8');
    expect(html).not.toMatch(/<script/);
  });

  it('accepts --no-js before or after positional args', () => {
    copyDemoHar();
    const r1 = runCli(['--no-js', 'demo.har', 'a.html']);
    const r2 = runCli(['demo.har', 'b.html', '--no-js']);

    expect(r1.status).toBe(0);
    expect(r2.status).toBe(0);

    for (const name of ['a.html', 'b.html']) {
      const html = readFileSync(resolve(workDir, name), 'utf8');
      expect(html).not.toMatch(/<script/);
    }
  });

  it('rejects --no-js combined with --attr', () => {
    copyDemoHar();
    const r = runCli(['--attr', '--no-js', 'demo.har', 'out.html']);

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--attr and --no-js are mutually exclusive/);

    // No output produced
    expect(existsSync(resolve(workDir, 'out.html'))).toBe(false);
  });

  it('default mode (no --no-js) DOES include the script tag', () => {
    // Regression guard for the --no-js flag toggle.
    copyDemoHar();
    const r = runCli(['demo.har', 'out.html']);

    expect(r.status).toBe(0);
    const html = readFileSync(resolve(workDir, 'out.html'), 'utf8');
    expect(html).toMatch(
      /<script type="module" src="waterfall\/waterfall\.js"/,
    );
    expect(existsSync(resolve(workDir, 'waterfall', 'waterfall.js'))).toBe(
      true,
    );
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// `--` stdout output
// ─────────────────────────────────────────────────────────────────────────────

describe('CLI: `--` writes component snippet to stdout', () => {
  function copyDemoHar(name = 'demo.har'): string {
    const dst = resolve(workDir, name);
    spawnSync('cp', [DEMO_HAR, dst]);
    return dst;
  }

  it('writes only the <waterfall-chart>…</waterfall-chart> element to stdout', () => {
    copyDemoHar();
    const r = runCli(['demo.har', '--']);

    expect(r.status).toBe(0);

    // No document scaffolding
    expect(r.stdout).not.toMatch(/<!doctype/i);
    expect(r.stdout).not.toMatch(/<html/);
    expect(r.stdout).not.toMatch(/<head/);
    expect(r.stdout).not.toMatch(/<body/);
    expect(r.stdout).not.toMatch(/<link/);
    expect(r.stdout).not.toMatch(/<script/);

    // Component is there, with its pre-rendered children
    expect(r.stdout).toMatch(/^<waterfall-chart>/);
    expect(r.stdout).toMatch(/<\/waterfall-chart>\s*$/);
    expect(r.stdout).toMatch(/class="wf-toolbar"/);
    expect(r.stdout).toMatch(/class="wf-row/);
  });

  it('does not write any status logging to stdout when using `--`', () => {
    // Critical for redirection: `... -- > file.html` must not include
    // "Wrote …" or similar progress lines in the file.
    copyDemoHar();
    const r = runCli(['demo.har', '--']);

    expect(r.status).toBe(0);
    expect(r.stdout).not.toMatch(/Wrote /);
    expect(r.stdout).not.toMatch(/assets in /);
  });

  it('does not create any output files or asset directories', () => {
    copyDemoHar();
    const before = readdirSync(workDir).sort();
    const r = runCli(['demo.har', '--']);

    expect(r.status).toBe(0);
    expect(readdirSync(workDir).sort()).toEqual(before);

    // No derived demo.html, no waterfall/ dir
    expect(existsSync(resolve(workDir, 'demo.html'))).toBe(false);
    expect(existsSync(resolve(workDir, 'waterfall'))).toBe(false);
  });

  it('emits <waterfall-chart src="…"> with --attr and does not copy the HAR', () => {
    copyDemoHar('trace.har');
    const r = runCli(['--attr', 'trace.har', '--']);

    expect(r.status).toBe(0);
    expect(r.stdout).toMatch(
      /^<waterfall-chart src="trace\.har"><\/waterfall-chart>\s*$/,
    );

    // HAR should NOT be duplicated anywhere; the original is the only copy
    expect(readdirSync(workDir)).toEqual(['trace.har']);
  });

  it('still rejects --no-js + --attr combined with `--`', () => {
    copyDemoHar();
    const r = runCli(['--attr', '--no-js', 'demo.har', '--']);

    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/--attr and --no-js are mutually exclusive/);
  });

  it('rejects `--` as the input HAR path', () => {
    const r = runCli(['--', 'out.html']);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/input HAR path cannot be "--"/);
  });

  it('shell-redirected stdout produces a valid component-only HTML file', () => {
    // End-to-end check of the documented workflow:
    //   npx … abc.har -- > abc_component_only.html
    copyDemoHar();
    const outPath = resolve(workDir, 'component-only.html');
    const r = spawnSync(
      'sh',
      ['-c', `node "${CLI}" demo.har -- > "${outPath}"`],
      {
        cwd: workDir,
        encoding: 'utf8',
      },
    );

    expect(r.status).toBe(0);
    expect(existsSync(outPath)).toBe(true);
    const html = readFileSync(outPath, 'utf8');
    expect(html).toMatch(/^<waterfall-chart>/);
    expect(html).toMatch(/<\/waterfall-chart>\s*$/);
    expect(html).not.toMatch(/<!doctype/i);
  });
});
