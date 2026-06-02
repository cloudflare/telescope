import crypto from 'crypto';

/**
 * Matches an `http://` or `https://` prefix (case-insensitive).
 *
 * Telescope only supports HTTP performance testing, so http(s) are the only
 * schemes accepted anywhere in the system (CLI and programmatic API alike).
 */
const HTTP_SCHEME_RE = /^https?:\/\//i;

/**
 * Matches a "hostname-like" input that the CLI is willing to auto-prefix
 * with an http(s) scheme. The scheme chosen depends on the host: see
 * `LOCALHOST_HOST_RE` below for the http:// fallback rules.
 *
 *   - Starts with an alphanumeric character (DNS label or IPv4 octet).
 *   - Continues with letters/digits/dots/hyphens (DNS labels, IPv4).
 *   - Optionally followed by a `:port` (digits only).
 *   - Optionally followed by a path (`/...`), query string (`?...`), and/or
 *     fragment (`#...`). All three are allowed because SPA-style routes such
 *     as `example.com/#/dashboard` are a common test target.
 *
 * This is deliberately stricter than RFC 3986 so that bare-scheme URIs
 * like `mailto:user@example.com`, `about:blank`, or `data:text/html,...`
 * do NOT match: they contain `:` followed by a non-digit, so they fail
 * the optional `:\d+` requirement. They are rejected up front instead of
 * being silently rewritten to nonsense like `https://mailto:user@...`.
 *
 * Inputs like `localhost:3000` and `127.0.0.1:8080` DO match (host:port).
 * They are auto-prefixed with `http://` because localhost-equivalent hosts
 * rarely have TLS configured. Non-localhost hosts get `https://`.
 *
 * IPv6 literals (`[::1]:3000`) are not supported here -- callers should
 * provide them with an explicit `http(s)://` prefix.
 */
const HOSTNAME_LIKE_RE =
  /^[a-z0-9][a-z0-9.-]*(?::\d+)?(?:\/[^?#]*)?(?:\?[^#]*)?(?:#.*)?$/i;

/**
 * Matches the host portion of a hostname-like input that should default to
 * `http://` rather than `https://` when scheme auto-prefixing kicks in.
 *
 * Treats the following as localhost-equivalents (RFC 6761 / RFC 1122):
 *
 *   - `localhost` (case-insensitive)
 *   - `*.localhost` -- any subdomain of `.localhost`
 *   - `127.x.x.x` -- the entire IPv4 loopback `/8`
 *
 * Other private/local-network conventions (`0.0.0.0`, `10.x`, `192.168.x`,
 * `*.local`, `host.docker.internal`, etc.) are NOT treated as localhost
 * and default to `https://` like any other host.
 *
 * The lookahead `(?=[:/?#]|$)` ensures we only match the host portion,
 * preventing false matches against something like `localhostlookalike.com`.
 */
const LOCALHOST_HOST_RE =
  /^(?:localhost|[^/?#:]+\.localhost|127(?:\.\d{1,3}){3})(?=[:/?#]|$)/i;

/**
 * Normalize the scheme of a CLI-provided URL.
 *
 * Behavior:
 *   - If the input already starts with `http://` or `https://`, return it
 *     unchanged (explicit user choice wins).
 *   - Otherwise, if it looks like a hostname (optionally with `:port`,
 *     `/path`, `?query`, or `#fragment`), prepend a scheme:
 *       - `http://` for localhost-equivalents (`localhost`, `*.localhost`,
 *         `127.x.x.x`) since local dev servers rarely have TLS configured.
 *       - `https://` for everything else.
 *   - Otherwise, throw an Error. Telescope only supports HTTP testing, so
 *     non-http(s) URLs (`file://`, `ftp://`, `about:blank`, `data:...`,
 *     `mailto:...`, etc.) are rejected at the CLI boundary.
 *
 * This helper is for CLI input only. The programmatic API (`launchTest`,
 * `Telescope`) enforces the http(s)-only restriction separately and does
 * NOT auto-prefix scheme-less inputs.
 *
 * Examples:
 *   normalizeUrlScheme('example.com')          -> 'https://example.com'
 *   normalizeUrlScheme('example.com/p?x=1')    -> 'https://example.com/p?x=1'
 *   normalizeUrlScheme('localhost:3000')       -> 'http://localhost:3000'
 *   normalizeUrlScheme('127.0.0.1:8080')       -> 'http://127.0.0.1:8080'
 *   normalizeUrlScheme('app.localhost')        -> 'http://app.localhost'
 *   normalizeUrlScheme('https://localhost')    -> 'https://localhost'
 *   normalizeUrlScheme('https://example.com')  -> 'https://example.com'
 *   normalizeUrlScheme('http://example.com')   -> 'http://example.com'
 *   normalizeUrlScheme('ftp://example.com')    -> throws
 *   normalizeUrlScheme('about:blank')          -> throws
 *
 * @param url - The URL string to normalize
 * @returns The normalized URL with an explicit http(s) scheme
 * @throws If the input is neither http(s):// nor a recognizable hostname
 */
export function normalizeUrlScheme(url: string): string {
  if (HTTP_SCHEME_RE.test(url)) {
    return url;
  }
  if (HOSTNAME_LIKE_RE.test(url)) {
    const scheme = LOCALHOST_HOST_RE.test(url) ? 'http' : 'https';
    return `${scheme}://${url}`;
  }
  throw new Error(
    `Only http:// and https:// URLs are supported (got "${url}")`,
  );
}

/**
 * Returns true if the input is an `http://` or `https://` URL.
 *
 * Used by the programmatic API (`executeTest`) to enforce the http(s)-only
 * restriction. Unlike `normalizeUrlScheme`, this does no rewriting and
 * does not accept hostname-like inputs -- programmatic callers must
 * provide a well-formed http(s) URL.
 */
export function isHttpUrl(url: string): boolean {
  return HTTP_SCHEME_RE.test(url);
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
