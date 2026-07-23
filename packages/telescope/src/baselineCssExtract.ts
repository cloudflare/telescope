import { BASE64 } from './types.js';
import type { CSSSource, HarData, HARContentEncoding } from './types.js';

/**
 * Extract external stylesheets (`text/css` responses) shipped by a page from
 * its HAR.
 *
 * Inline `<style>` blocks in HTML documents are handled separately, in a
 * follow-up change that parses the HTML with a dedicated parser.
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
