import crypto from 'crypto';

/**
 * Matches a hierarchical URI prefix: a scheme followed by the literal `://`
 * (as in `http://`, `https://`, `file://`, `ftp://`).
 *
 * The scheme character class (`[a-z][a-z0-9+.-]*`) follows RFC 3986 §3.1,
 * but this regex intentionally requires the `://` separator and does NOT
 * match bare-scheme URIs such as `mailto:user@example.com` or
 * `tel:+15555550123`. That is deliberate: it lets `normalizeUrl` treat
 * inputs like `localhost:3000` as a host:port pair (no `://`) rather than
 * as a URI with scheme `localhost`. Browsers cannot navigate to bare-scheme
 * URIs anyway, so refining this regex to accept them would only break
 * host:port handling.
 */
const SCHEME_RE = /^[a-z][a-z0-9+.-]*:\/\//i;

/**
 * Normalize a URL by prepending `https://` if no scheme is present.
 * Examples:
 *   normalizeUrl('example.com')         -> 'https://example.com'
 *   normalizeUrl('example.com/path')    -> 'https://example.com/path'
 *   normalizeUrl('https://example.com') -> 'https://example.com'
 *   normalizeUrl('http://example.com')  -> 'http://example.com'
 *
 * Strings that already contain an explicit scheme (e.g. `http://`, `https://`,
 * `file://`) are returned unchanged.
 *
 * @param url - The URL string to normalize
 * @returns The normalized URL with an explicit scheme
 */
export function normalizeUrl(url: string): string {
  if (SCHEME_RE.test(url)) {
    return url;
  }
  return `https://${url}`;
}

/**
 * Simple debug logger that only logs when DEBUG_MODE is set
 */
export function log(msg: unknown): void {
  if (process.env.DEBUG_MODE) {
    console.log(msg);
  }
}

/**
 * Log timing information when in debug mode
 */
export function logTimer(msg: string, end: number, start: number): void {
  log(`TIMING::${msg} ${(end - start).toFixed(2)} ms`);
}

/**
 * Generate a unique test ID with timestamp and UUID
 */
export function generateTestID(): string {
  const date_ob = new Date();
  // adjust 0 before single digit value
  const date = ('0' + date_ob.getDate()).slice(-2);
  const month = ('0' + (date_ob.getMonth() + 1)).slice(-2);
  const year = date_ob.getFullYear();
  const hour = ('0' + date_ob.getHours()).slice(-2);
  const minute = ('0' + date_ob.getMinutes()).slice(-2);
  const second = ('0' + date_ob.getSeconds()).slice(-2);

  return (
    year +
    '_' +
    month +
    '_' +
    date +
    '_' +
    hour +
    '_' +
    minute +
    '_' +
    second +
    '_' +
    crypto.randomUUID()
  );
}
