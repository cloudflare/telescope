#!/usr/bin/env node
/**
 * @cloudflare/waterfall — CLI
 *
 * Renders a HAR file to a standalone HTML document and copies the
 * `waterfall.css` and `waterfall.js` assets into a sibling `waterfall/`
 * folder next to the output HTML. The HTML references them via relative
 * `waterfall/waterfall.css` and `waterfall/waterfall.js` URLs, so the
 * result is fully self-contained and works when opened from disk or
 * served statically.
 *
 * Usage:
 *   npx @cloudflare/waterfall [--attr] [--no-js] <input.har> [output.html | --]
 *
 * If the output path is omitted, the HTML file is named after the HAR file
 * (e.g. demo.har → demo.html) and written to the current working directory.
 *
 * If the output is `--`, the bare `<waterfall-chart>…</waterfall-chart>`
 * snippet is written to stdout (no document scaffolding, no asset copying,
 * no logging on stdout) so it can be redirected or piped into other tools:
 *   npx @cloudflare/waterfall abc.har -- > abc_component_only.html
 *
 * --attr:  instead of pre-rendering the waterfall HTML into the document,
 *   copy the HAR file next to the output and emit
 *   `<waterfall-chart src="harname.har"></waterfall-chart>`. The browser
 *   fetches the HAR via the bundled JS at runtime. Useful when serving
 *   pages statically and you want to keep the HAR separate.
 *
 * --no-js: omit the `<script>` tag and skip copying `waterfall.js`. Only
 *   the stylesheet is referenced and the result renders statically from
 *   the pre-rendered children + `waterfall.css`. Incompatible with `--attr`
 *   (the attr mode relies on JS to fetch the HAR at runtime).
 */

import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { basename, dirname, extname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Import directly from render.js to avoid pulling in the web component,
// which references browser globals (HTMLElement, document, …) unavailable
// in Node.js.
import { renderToHTML } from './render.js';
import type { Har } from './har.js';

/**
 * Resolved output destination.
 *  - `{ kind: 'file', path }` — write a full HTML document to the given path
 *    and copy assets into a sibling `waterfall/` folder.
 *  - `{ kind: 'stdout' }` — write only the `<waterfall-chart>` snippet to
 *    stdout; no asset copying, no file I/O.
 */
type OutputTarget = { kind: 'file'; path: string } | { kind: 'stdout' };

interface ParsedArgs {
  input: string;
  output: OutputTarget;
  attr: boolean;
  noJs: boolean;
}

function printUsage(stream: NodeJS.WriteStream): void {
  stream.write(
    'Usage: npx @cloudflare/waterfall [--attr] [--no-js] <input.har> [output.html | --]\n' +
      '\n' +
      'If [output.html] is omitted, it is derived from the input filename\n' +
      '(e.g. demo.har → demo.html) and written to the current directory.\n' +
      '\n' +
      'If the output is `--`, only the <waterfall-chart>...</waterfall-chart>\n' +
      'snippet is written to stdout (no document scaffolding, no asset copying).\n' +
      '\n' +
      '--attr   Skip pre-rendering. Copy the HAR next to the output and emit\n' +
      '         <waterfall-chart src="<harname>.har">. The component fetches\n' +
      '         the HAR at runtime via the bundled JS.\n' +
      '--no-js  Omit the <script> tag and do not copy waterfall.js. The output\n' +
      '         renders statically from pre-rendered children + waterfall.css.\n' +
      '         Cannot be combined with --attr.\n',
  );
}

/**
 * Derive an HTML output filename from an input HAR path.
 * Strips the trailing `.har` extension (case-insensitive) and appends `.html`.
 * Files without a `.har` extension just get `.html` appended.
 * The result is placed in the current working directory.
 */
function deriveOutputPath(inputPath: string): string {
  const base = basename(inputPath);
  const ext = extname(base);
  const stem = ext.toLowerCase() === '.har' ? base.slice(0, -ext.length) : base;
  return resolve(process.cwd(), `${stem}.html`);
}

function parseArgs(argv: string[]): ParsedArgs {
  const raw = argv.slice(2);

  if (raw.includes('-h') || raw.includes('--help')) {
    printUsage(process.stdout);
    process.exit(0);
  }

  // Extract flags; everything else is a positional argument. `--` is
  // reserved as a sentinel for "stdout output", so it is NOT treated as
  // an option even though it starts with `-`.
  let attr = false;
  let noJs = false;
  const positional: string[] = [];
  for (const arg of raw) {
    if (arg === '--attr') {
      attr = true;
    } else if (arg === '--no-js') {
      noJs = true;
    } else if (arg === '--') {
      // Sentinel for "write component snippet to stdout".
      positional.push(arg);
    } else if (arg.startsWith('--')) {
      process.stderr.write(`Error: unknown option: ${arg}\n`);
      printUsage(process.stderr);
      process.exit(1);
    } else {
      positional.push(arg);
    }
  }

  if (attr && noJs) {
    process.stderr.write(
      'Error: --attr and --no-js are mutually exclusive ' +
        '(--attr requires JS to fetch the HAR at runtime).\n',
    );
    printUsage(process.stderr);
    process.exit(1);
  }

  if (positional.length < 1 || positional.length > 2) {
    process.stderr.write(
      `Error: expected 1 or 2 positional arguments, got ${positional.length}.\n`,
    );
    printUsage(process.stderr);
    process.exit(1);
  }

  const [inputArg, outputArg] = positional as [string, string | undefined];

  if (inputArg === '--') {
    process.stderr.write('Error: input HAR path cannot be "--".\n');
    printUsage(process.stderr);
    process.exit(1);
  }

  const input = isAbsolute(inputArg)
    ? inputArg
    : resolve(process.cwd(), inputArg);

  let output: OutputTarget;
  if (outputArg === undefined) {
    output = { kind: 'file', path: deriveOutputPath(input) };
  } else if (outputArg === '--') {
    output = { kind: 'stdout' };
  } else {
    output = {
      kind: 'file',
      path: isAbsolute(outputArg)
        ? outputArg
        : resolve(process.cwd(), outputArg),
    };
  }

  return { input, output, attr, noJs };
}

function readHar(path: string): Har {
  let raw: string;
  try {
    raw = readFileSync(path, 'utf8');
  } catch (err) {
    process.stderr.write(
      `Error: could not read HAR file: ${path}\n  ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  try {
    return JSON.parse(raw) as Har;
  } catch (err) {
    process.stderr.write(
      `Error: failed to parse HAR JSON: ${path}\n  ${(err as Error).message}\n`,
    );
    process.exit(1);
  }
}

/**
 * Copy the waterfall assets from the package's `dist/` (which is also where
 * this CLI script lives at runtime) into `<outputDir>/waterfall/`. Always
 * copies `waterfall.css`; copies `waterfall.js` unless `includeJs` is false.
 */
function copyAssets(outputDir: string, includeJs: boolean): void {
  const distDir = dirname(fileURLToPath(import.meta.url));
  const assetsDir = resolve(outputDir, 'waterfall');

  try {
    mkdirSync(assetsDir, { recursive: true });
  } catch (err) {
    process.stderr.write(
      `Error: could not create assets directory: ${assetsDir}\n  ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  const names = includeJs
    ? ['waterfall.css', 'waterfall.js']
    : ['waterfall.css'];
  for (const name of names) {
    const src = resolve(distDir, name);
    const dst = resolve(assetsDir, name);
    try {
      copyFileSync(src, dst);
    } catch (err) {
      process.stderr.write(
        `Error: could not copy ${name} from ${src} to ${dst}\n  ${(err as Error).message}\n`,
      );
      process.exit(1);
    }
  }
}

/**
 * Copy the HAR file next to the output HTML so the `src` attribute can
 * reference it via a relative URL.
 * @returns the basename of the copied HAR (the value used for `src`).
 */
function copyHar(inputHarPath: string, outputDir: string): string {
  const harName = basename(inputHarPath);
  const dst = resolve(outputDir, harName);
  try {
    copyFileSync(inputHarPath, dst);
  } catch (err) {
    process.stderr.write(
      `Error: could not copy HAR file from ${inputHarPath} to ${dst}\n  ${(err as Error).message}\n`,
    );
    process.exit(1);
  }
  return harName;
}

/**
 * HTML-escape an attribute value (covers the characters that matter inside
 * a double-quoted attribute).
 */
function escAttr(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

type ChartBody =
  | { mode: 'inline'; innerHtml: string }
  | { mode: 'attr'; src: string };

/**
 * Render just the `<waterfall-chart>…</waterfall-chart>` element (no
 * surrounding document). Used both as the inner snippet of a full
 * document and as the standalone stdout output.
 */
function renderChartElement(body: ChartBody): string {
  return body.mode === 'inline'
    ? `<waterfall-chart>\n${body.innerHtml}\n</waterfall-chart>`
    : `<waterfall-chart src="${escAttr(body.src)}"></waterfall-chart>`;
}

function buildDocument(body: ChartBody, includeJs: boolean): string {
  const chart =
    body.mode === 'inline'
      ? `<waterfall-chart>\n${body.innerHtml}\n    </waterfall-chart>`
      : `<waterfall-chart src="${escAttr(body.src)}"></waterfall-chart>`;

  const scriptTag = includeJs
    ? '\n    <script type="module" src="waterfall/waterfall.js"></script>'
    : '';

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Waterfall</title>
    <link rel="stylesheet" href="waterfall/waterfall.css" />${scriptTag}
  </head>
  <body>
    ${chart}
  </body>
</html>
`;
}

/**
 * Build the chart body — either pre-rendered inline content or an `src`
 * attribute pointing at a HAR file. Side-effect: when `attr` is true and
 * we are writing to a file, copies the HAR next to the output and returns
 * the copied basename via the closure so `main()` can report it.
 *
 * @param input absolute path to the input HAR
 * @param attr  whether --attr was passed
 * @param fileOutputDir directory of the output HTML file, or null for stdout
 *   mode (in stdout mode --attr just emits `src="<basename>"` without
 *   copying the HAR anywhere).
 * @returns the chart body plus the copied HAR basename, if any.
 */
function buildChartBody(
  input: string,
  attr: boolean,
  fileOutputDir: string | null,
): { body: ChartBody; harCopied: string | null } {
  if (attr) {
    // Verify the HAR exists/is readable, but don't parse it — the browser
    // will fetch and parse it via the bundled JS at runtime.
    try {
      readFileSync(input);
    } catch (err) {
      process.stderr.write(
        `Error: could not read HAR file: ${input}\n  ${(err as Error).message}\n`,
      );
      process.exit(1);
    }

    const name =
      fileOutputDir !== null ? copyHar(input, fileOutputDir) : basename(input);
    return {
      body: { mode: 'attr', src: name },
      harCopied: fileOutputDir !== null ? name : null,
    };
  }

  const har = readHar(input);
  const inner = renderToHTML(har);
  return { body: { mode: 'inline', innerHtml: inner }, harCopied: null };
}

function main(): void {
  const { input, output, attr, noJs } = parseArgs(process.argv);
  const includeJs = !noJs;

  if (output.kind === 'stdout') {
    // Component-only output to stdout. No file I/O, no asset copying, no
    // status logging on stdout (so the result can be cleanly redirected).
    const { body } = buildChartBody(input, attr, null);
    process.stdout.write(renderChartElement(body) + '\n');
    return;
  }

  const outputPath = output.path;
  const outputDir = dirname(outputPath);
  try {
    mkdirSync(outputDir, { recursive: true });
  } catch (err) {
    process.stderr.write(
      `Error: could not create output directory: ${outputDir}\n  ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  const { body, harCopied } = buildChartBody(input, attr, outputDir);
  const doc = buildDocument(body, includeJs);

  try {
    writeFileSync(outputPath, doc, 'utf8');
  } catch (err) {
    process.stderr.write(
      `Error: could not write output file: ${outputPath}\n  ${(err as Error).message}\n`,
    );
    process.exit(1);
  }

  copyAssets(outputDir, includeJs);

  const extras = harCopied ? `, HAR copied as ${harCopied}` : '';
  process.stdout.write(
    `Wrote ${outputPath} (assets in ${resolve(outputDir, 'waterfall')}${extras})\n`,
  );
}

main();
