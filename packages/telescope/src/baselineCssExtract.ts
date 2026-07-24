import type { Page } from 'playwright';

import { BASE64 } from './types.js';
import type { CSSSource, HarData, HARContentEncoding } from './types.js';

/**
 * Extract external stylesheets (`text/css` responses) shipped by a page from
 * its HAR.
 *
 * Inline `<style>` blocks are handled separately by {@link harvestInlineStyles},
 * which reads them from the live DOM.
 *
 * @param harData - Parsed HAR file contents.
 * @returns One {@link CSSSource} per stylesheet, in the order they appear in
 *   the HAR. Entries without a response body are skipped.
 */
export function extractCSSFromHar(harData: HarData): CSSSource[] {
  const sources: CSSSource[] = [];

  for (const entry of harData.log.entries) {
    const { text, encoding, mimeType } = entry.response.content;
    if (!text) continue;

    if (mimeType.toLowerCase().startsWith('text/css')) {
      sources.push({
        css: decodeContent(text, encoding),
        file: entry.request.url,
      });
    }
  }

  return sources;
}

/**
 * Harvest inline `<style>` blocks from the *live* DOM of a page.
 *
 * External stylesheets are recovered from the HAR by {@link extractCSSFromHar};
 * inline CSS is read here from the rendered document so that `<style>` blocks
 * injected at runtime (e.g. by JavaScript) are captured — something static HTML
 * parsing would miss.
 *
 * The read is strictly read-only: it neither mutates the DOM nor triggers
 * layout, so it can run after metrics collection without perturbing
 * performance measurements.
 *
 * Only the text of `<style>` elements in the main document is read. CSS with
 * no `<style>` text — rules added via `CSSStyleSheet.insertRule()` or
 * constructable `adoptedStyleSheets` — is not included, nor are `<style>`
 * elements inside shadow roots (`querySelectorAll` does not pierce shadow DOM)
 * or `<template>` content.
 *
 * @param page - A Playwright page whose document has finished loading.
 * @returns One {@link CSSSource} per non-empty `<style>` block, in document
 *   order. `file` identifies the page and the block's position within it.
 */
export async function harvestInlineStyles(page: Page): Promise<CSSSource[]> {
  const blocks = await page.evaluate(() =>
    // `textContent` on an element is always a string; `?? ''` only satisfies
    // its `string | null` type (null is unreachable for these nodes).
    Array.from(
      document.querySelectorAll('style'),
      style => style.textContent ?? '',
    ),
  );

  const pageUrl = page.url();
  const sources: CSSSource[] = [];
  for (const css of blocks) {
    if (css.trim().length === 0) continue;

    sources.push({
      css,
      file: `${pageUrl} (inline style #${sources.length + 1})`,
    });
  }

  return sources;
}

/**
 * Decode a HAR response body, handling base64-encoded content.
 *
 * @param text - The raw `content.text` value from a HAR entry.
 * @param encoding - The `content.encoding` value, if present.
 * @returns The decoded body as UTF-8 text.
 */
function decodeContent(text: string, encoding: HARContentEncoding): string {
  if (encoding === BASE64) {
    return Buffer.from(text, BASE64).toString('utf8');
  }
  return text;
}
