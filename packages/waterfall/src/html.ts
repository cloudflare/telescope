/**
 * Tiny HTML templating helper with auto-escaping.
 *
 * Exists so that string-building renderers (notably `render.ts`) cannot ship an
 * unescaped interpolation by accident. Every interpolation in an `html\`...\``
 * tagged template is HTML-escaped unless explicitly wrapped in `safe()`.
 *
 * Output is a `Safe` token (a marker object holding a string), so nested
 * templates compose without double-escaping. Call `render()` at the boundary
 * to extract the final string.
 *
 * This is intentionally minimal — no DOM, no diffing, no streaming. It is the
 * smallest possible thing that fixes the "forgot to escape" footgun.
 *
 * Pure, side-effect free. Runs in Node.js or the browser.
 *
 * Note: Prettier recognises `html\`...\`` tagged templates and applies its
 * HTML formatter to their contents. The resulting reflow is functionally
 * equivalent — whitespace between HTML block elements is insignificant — but
 * the byte-exact SSR snapshot must be regenerated whenever the templates
 * change.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A string that has been escaped (or audited) as safe to splice into HTML.
 *
 * The `html` tag returns `Safe`. When a `Safe` is interpolated into another
 * `html` template it is spliced verbatim (no double-escape).
 */
export interface Safe {
  readonly __html: string;
}

const isSafe = (v: unknown): v is Safe =>
  typeof v === 'object' && v !== null && '__html' in v;

// ─────────────────────────────────────────────────────────────────────────────
// Escaping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escape an arbitrary value for HTML text and double-quoted attribute values.
 *
 * Covers the OWASP-recommended six characters: `& < > " ' \``. Accepts any
 * value and coerces via `String()` — `null`/`undefined` become the literal
 * strings `"null"`/`"undefined"`.
 *
 * Private to this module; callers use the `html\`...\`` tag, which calls this
 * on every interpolation.
 *
 * NOT safe for URL, CSS, or JavaScript contexts. Do not interpolate untrusted
 * values into `href=`, `style=`, `on*=`, or `<script>` bodies even after
 * escaping — use a context-specific helper or refuse the input.
 */
function esc(v: unknown): string {
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Safe constructors / unwrapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Mark a string as already-safe HTML. Bypasses auto-escaping when interpolated
 * into an `html\`...\`` template.
 *
 * Every call site is a security review checkpoint. Only pass strings that
 * either contain no user input or have been escaped/validated elsewhere.
 */
export const safe = (s: string): Safe => ({ __html: s });

/**
 * A pre-built `Safe` for a CSS percentage value derived from a number.
 *
 * Use for `style="left:${pct(x)}"` etc. — guarantees the interpolated value
 * cannot escape the attribute or introduce a CSS expression, by accepting
 * `number` rather than `string`.
 */
export const pct = (n: number): Safe => safe(`${n.toFixed(4)}%`);

/**
 * Unwrap a `Safe` to its underlying string. Use only at the public boundary
 * where the caller expects a plain string (e.g. `renderToHTML(har): string`).
 */
export const render = (t: Safe): string => t.__html;

/**
 * Join an array of `Safe` fragments with a literal separator.
 *
 * The separator is spliced verbatim (it's a separator, not data) — keep it
 * to whitespace and structural punctuation, never user input.
 */
export const join = (items: readonly Safe[], sep: string): Safe =>
  safe(items.map((s) => s.__html).join(sep));

// ─────────────────────────────────────────────────────────────────────────────
// The tag
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Tagged template literal that auto-escapes every interpolation.
 *
 * Behaviour by value type:
 *  - `Safe`               — spliced verbatim
 *  - `Array<Safe | unknown>` — each element handled per these same rules,
 *                              then joined with no separator
 *  - everything else      — coerced via `String(v)` and HTML-escaped
 *
 * @example
 *   html`<p>${userInput}</p>`                            // escaped
 *   html`<ul>${items.map(i => html`<li>${i}</li>`)}</ul>` // nested templates
 *   html`<div>${safe(trustedMarkup)}</div>`              // explicit opt-out
 */
export function html(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Safe {
  let out = strings[0]!;
  for (let i = 0; i < values.length; i++) {
    out += stringify(values[i]);
    out += strings[i + 1]!;
  }
  return { __html: out };
}

function stringify(v: unknown): string {
  if (isSafe(v)) return v.__html;
  if (Array.isArray(v)) return v.map(stringify).join('');
  return esc(v);
}
