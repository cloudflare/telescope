#!/usr/bin/env node
/**
 * scripts/gen-demo.js
 *
 * Generates the pre-rendered waterfall HTML for the demo page and splices it
 * into index.html between the marker comments:
 *
 *   <!-- wf-demo-start -->
 *   ...generated HTML...
 *   <!-- wf-demo-end -->
 *
 * Usage:
 *   node scripts/gen-demo.js [path/to/file.har]
 *
 * The HAR file path is optional; it defaults to demo.har in the package root.
 * Pass a different path to render any HAR file into the demo pages:
 *
 *   node scripts/gen-demo.js ~/Downloads/my-trace.har
 *
 * Run this after `npm run build` whenever the demo HAR data or the renderer
 * changes.
 */

import { readFileSync, writeFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, resolve, basename, isAbsolute } from 'path';
// Import directly from dist/render.js to avoid pulling in the web component
// (which requires HTMLElement / browser globals unavailable in Node.js).
import { renderToHTML } from '../dist/render.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '..');

// All pages that contain the wf-demo markers
const DEMO_PAGES = [
  resolve(ROOT, 'index.html'),
  resolve(ROOT, 'interactive.html'),
];

// ── Resolve HAR file path ─────────────────────────────────────────────────────
// Accept an optional positional argument; fall back to demo.har.
const harArg = process.argv[2];
const harPath = harArg
  ? isAbsolute(harArg)
    ? harArg
    : resolve(process.cwd(), harArg)
  : resolve(ROOT, 'demo.har');

let harJson;
try {
  harJson = readFileSync(harPath, 'utf8');
} catch (err) {
  console.error(`✗ Could not read HAR file: ${harPath}`);
  console.error(`  ${err.message}`);
  process.exit(1);
}

let demoHar;
try {
  demoHar = JSON.parse(harJson);
} catch (err) {
  console.error(`✗ Failed to parse HAR JSON from: ${harPath}`);
  console.error(`  ${err.message}`);
  process.exit(1);
}

console.log(`  HAR: ${harPath}`);

// ── Render and splice into all demo pages ────────────────────────────────────

const rendered = renderToHTML(demoHar);

// Indent each line of the rendered block by 4 spaces to match surrounding HTML
const indented = rendered
  .split('\n')
  .map((line) => (line.trim() ? '    ' + line : ''))
  .join('\n');

const START_MARKER = '<!-- wf-demo-start -->';
const END_MARKER = '<!-- wf-demo-end -->';

for (const filePath of DEMO_PAGES) {
  const html = readFileSync(filePath, 'utf8');

  const startIdx = html.indexOf(START_MARKER);
  const endIdx = html.indexOf(END_MARKER);

  if (startIdx === -1 || endIdx === -1) {
    console.error(
      `✗ Could not find wf-demo markers in ${basename(filePath)} — skipping`,
    );
    continue;
  }

  const before = html.slice(0, startIdx + START_MARKER.length);
  const after = html.slice(endIdx);
  const updated = `${before}\n${indented}\n    ${after}`;

  writeFileSync(filePath, updated, 'utf8');
  console.log(`✓ ${basename(filePath)} (${rendered.length} chars)`);
}
