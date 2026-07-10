/**
 * SSR snapshot test for renderToHTML().
 *
 * Locks in the byte-exact output of renderToHTML() against the canonical
 * public/demo.har fixture so any unintended drift during refactors is caught
 * immediately.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

import { renderToHTML } from '../dist/render.js';
import type { Har } from '../dist/har.js';

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const DEMO_HAR: Har = JSON.parse(
  fs.readFileSync(path.resolve(PKG_ROOT, 'public', 'demo.har'), 'utf8'),
);

describe('renderToHTML', () => {
  it('matches the snapshot for the demo HAR fixture', () => {
    const html = renderToHTML(DEMO_HAR);
    expect(html).toMatchSnapshot();
  });

  it('returns an error message for an empty HAR', () => {
    const empty: Har = {
      log: {
        version: '1.2',
        creator: { name: 'test', version: '0' },
        entries: [],
      },
    };
    expect(renderToHTML(empty)).toBe(
      '<p class="wf-message wf-message--error">No entries in HAR file.</p>',
    );
  });
});
