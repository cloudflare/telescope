/**
 * renderToHTML(har) — server-side / build-time static renderer.
 *
 * Produces the exact same HTML structure that the <waterfall-chart> custom
 * element builds dynamically, so that `waterfall.css` can render a fully
 * functional (non-interactive) waterfall chart with zero JavaScript.
 *
 * When the JS bundle loads and the custom element upgrades, it detects the
 * pre-rendered children and wires up interactivity without re-rendering.
 *
 * Pure function — no DOM, no side-effects. Runs in Node.js or the browser.
 *
 * All HTML construction goes through the `html\`...\`` tag from `./html.js`,
 * which auto-escapes every interpolation. The only escape hatch is `safe()`
 * — each call site is a security review checkpoint.
 */

import { typeConfig, TYPE_SWATCH, TYPE_LABEL } from './config.js';
import { fmtSize, fmtMs } from './formatters.js';
import { html, join, pct, render, safe, type Safe } from './html.js';
import {
  parseUrl,
  resourceType,
  computeTotalMs,
  uniqueTypes,
  pageEvents,
  fmtEventLabel,
} from './helpers.js';
import {
  PHASE_BUTTONS,
  computeTimelineLayout,
  entrySize,
  presentEvents,
  rowClasses,
  rowDataAttrs,
  statusClass,
  tickPositions,
} from './layout.js';
import type { Har, HarEntry, HarPage } from './har.js';

type HarPageTimings = HarPage['pageTimings'];

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

const typeLabel = (t: string): string => TYPE_LABEL[t] ?? t;

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar (filter chips + toggle button)
//
// TYPE_SWATCH values, PHASE_BUTTONS keys, and EVENT_DEFS keys come from
// in-source enums (config.ts, layout.ts) — never from HAR data — so the
// `safe()` calls splicing them into class names are auditable as
// developer-controlled.
// ─────────────────────────────────────────────────────────────────────────────

function renderToolbar(types: string[], pageTimings: HarPageTimings): Safe {
  const chips = types.map((t, i) => {
    const key = TYPE_SWATCH[t];
    const swatch = key
      ? html`<span
          class="wf-swatch wf-swatch--thick wf-swatch--${safe(key)}"
        ></span>`
      : '';
    const activeCls = i === 0 ? ' active' : '';
    return html`<button type="button" class="wf-filter-btn${activeCls}">
      ${swatch}${typeLabel(t)}
    </button>`;
  });

  const phaseBtns = PHASE_BUTTONS.map(
    ([key, label]) =>
      html`<button type="button" class="wf-filter-btn" data-phase="${key}">
        <span class="wf-swatch wf-swatch--thin wf-swatch--${safe(key)}"></span
        >${label}
      </button>`,
  );

  const eventBtns = presentEvents(pageTimings).map(
    ({ key, label }) =>
      html`<button
        type="button"
        class="wf-filter-btn active"
        data-event="${key}"
      >
        <span class="wf-swatch wf-swatch--thin wf-swatch--${safe(key)}"></span
        >${label}
      </button>`,
  );

  const metricsGroup =
    eventBtns.length > 0
      ? html`<div
          class="wf-legend-group"
          role="group"
          aria-label="Toggle metrics"
        >
          ${join(eventBtns, '\n    ')}
        </div>`
      : '';

  return html`<div class="wf-toolbar">
    <div
      class="wf-legend-group wf-filters"
      role="group"
      aria-label="Filter by resource type"
    >
      ${join(chips, '\n    ')}
    </div>
    <div
      class="wf-legend-group"
      role="group"
      aria-label="Filter by connection phase"
    >
      ${join(phaseBtns, '\n    ')}
    </div>
    ${metricsGroup}
  </div>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Ruler
// ─────────────────────────────────────────────────────────────────────────────

function renderRuler(totalMs: number): Safe {
  return join(
    tickPositions(totalMs).map((ms) => {
      const label = `${parseFloat((ms / 1000).toFixed(3))}s`;
      return html`<span
        class="wf-tick"
        style="left:${pct((ms / totalMs) * 100)}"
        >${label}</span
      >`;
    }),
    '\n      ',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Overlays
// Both overlays live inside .wf-col-header--timeline so their width equals the
// timeline column width. That means left:X% aligns with ruler ticks and bar
// positions in both the CSS-only static render and after JS upgrade.
//
// Grid lines go in .wf-grid-overlay (low z-index → behind request bars).
// Event lines go in .wf-events-overlay (high z-index → in front of bars).
// ─────────────────────────────────────────────────────────────────────────────

function renderGridLines(totalMs: number): Safe {
  return join(
    tickPositions(totalMs).map(
      (ms) =>
        html`<div
          class="wf-grid-line"
          style="left:${pct((ms / totalMs) * 100)}"
        ></div>`,
    ),
    '\n      ',
  );
}

function renderEventLines(pageTimings: HarPageTimings, totalMs: number): Safe {
  return join(
    pageEvents(pageTimings, totalMs).map(({ ms, cls, label }) => {
      const dataLabel = fmtEventLabel(label, ms);
      // `cls` is a controlled enum value from EVENT_DEFS in layout.ts.
      return html`<div
        class="wf-event-line ${safe(cls)}"
        data-ms="${ms}"
        data-label="${dataLabel}"
        data-name="${label}"
        style="left:${pct((ms / totalMs) * 100)}"
      ></div>`;
    }),
    '\n      ',
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline bar cell for one entry
// ─────────────────────────────────────────────────────────────────────────────

function renderTimelineCell(
  entry: HarEntry,
  totalMs: number,
  originMs: number,
): Safe {
  const { segments, barEndPct, durLabel } = computeTimelineLayout(
    entry,
    totalMs,
    originMs,
  );

  // Each segment's `cls` is a controlled string built from typeConfig() keys
  // and hardcoded phase identifiers in layout.ts — never user input.
  const bars = join(
    segments.map(
      (s) =>
        html`<div
          class="wb ${safe(s.cls)}"
          title="${s.tooltip}"
          style="left:${pct(s.leftPct)};width:${pct(Math.max(s.widthPct, 0.1))}"
        ></div>`,
    ),
    '\n          ',
  );

  return html`<span
    class="wf-cell wf-cell--timeline"
    style="--wf-bar-end:${pct(barEndPct)}"
  >
    <div class="wf-bar-wrap">
      ${bars}
      <span class="wf-bar-dur">${durLabel}</span>
    </div>
  </span>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// One <li> row
// ─────────────────────────────────────────────────────────────────────────────

function renderRow(
  entry: HarEntry,
  index: number,
  visIdx: number,
  totalMs: number,
  originMs: number,
): Safe {
  const type = resourceType(entry);
  const { barH } = typeConfig(type);
  const status = entry.response.status;
  const size = entrySize(entry);
  const { domain, path } = parseUrl(entry.request.url);

  const statusCls = statusClass(status);
  const rowClassStr = rowClasses(entry, barH);

  const pathCell = path ? html`<span class="wf-url-path">${path}</span>` : '';

  // data-* attributes encode all values needed by _entryFromRow() in the
  // web component's adopt path, so interactivity works without re-fetching HAR.
  const data = rowDataAttrs(entry);
  const queueingAttr =
    data['blocked-queueing'] !== undefined
      ? html` data-blocked-queueing="${data['blocked-queueing']}"`
      : '';
  const transferAttr =
    data['transfer-size'] !== undefined
      ? html` data-transfer-size="${data['transfer-size']}"`
      : '';

  // rowClassStr and statusCls come from layout.ts helpers that build strings
  // from typeConfig() keys and hardcoded status buckets — not from HAR data.
  return html`<li
    class="${safe(rowClassStr)}"
    data-index="${index}"
    data-started="${data.started!}"
    data-time="${data.time!}"
    data-blocked="${data.blocked!}"
    ${queueingAttr}
    data-dns="${data.dns!}"
    data-connect="${data.connect!}"
    data-ssl="${data.ssl!}"
    data-send="${data.send!}"
    data-wait="${data.wait!}"
    data-receive="${data.receive!}"
    data-body-size="${data['body-size']!}"
    ${transferAttr}
  >
    <span class="wf-cell wf-cell--idx">${visIdx}</span>
    <span class="wf-cell wf-cell--url" title="${entry.request.url}"
      ><span class="wf-url-domain">${domain}</span>${pathCell}</span
    >
    <span class="wf-cell wf-cell--info">${entry.request.method}</span>
    <span class="wf-cell wf-cell--info">${entry.request.httpVersion}</span>
    <span class="wf-cell wf-cell--info wf-cell--stat ${safe(statusCls)}"
      >${status}</span
    >
    <span class="wf-cell wf-cell--info">${type}</span>
    <span class="wf-cell wf-cell--info wf-cell--size">${fmtSize(size)}</span>
    <span class="wf-cell wf-cell--info wf-cell--dur">${fmtMs(entry.time)}</span>
    ${renderTimelineCell(entry, totalMs, originMs)}
  </li>`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Render a HAR object to a static HTML string.
 *
 * The returned markup is the inner HTML of a `<waterfall-chart>` element.
 * It renders correctly with only `waterfall.css` — no JavaScript required.
 * When the JS bundle loads, the custom element detects the pre-rendered
 * children and wires up interactivity without re-rendering.
 *
 * @example
 * // Node.js / build script
 * import { renderToHTML } from '@cloudflare/waterfall';
 * const html = renderToHTML(har);
 * fs.writeFileSync('waterfall.html', `<waterfall-chart>${html}</waterfall-chart>`);
 *
 * @example
 * // SSR (e.g. Astro)
 * ---
 * import { renderToHTML } from '@cloudflare/waterfall';
 * const html = renderToHTML(har);
 * ---
 * <waterfall-chart set:html={html} />
 */
export function renderToHTML(har: Har): string {
  const entries = har.log.entries ?? [];
  if (!entries.length)
    return '<p class="wf-message wf-message--error">No entries in HAR file.</p>';

  const totalMs = computeTotalMs(entries);
  const originMs = +new Date(entries[0]!.startedDateTime);
  const pageTimings = har.log.pages?.[0]?.pageTimings ?? {};
  const types = uniqueTypes(entries);

  // Ruler ticks
  const rulerHTML = renderRuler(totalMs);

  // Grid lines (behind bars) + event lines (in front of bars)
  const gridLinesHTML = renderGridLines(totalMs);
  const eventLinesHTML = renderEventLines(pageTimings, totalMs);

  // Request rows
  const rowsHTML = join(
    entries.map((entry, i) => renderRow(entry, i, i + 1, totalMs, originMs)),
    '\n    ',
  );

  return render(
    html`${renderToolbar(types, pageTimings)}

      <div class="wf-list-wrap">
        <div class="wf-col-headers" aria-hidden="true">
          <div class="wf-col-header wf-col-header--idx">#</div>
          <div class="wf-col-header wf-col-header--url">URL</div>
          <div class="wf-col-header wf-col-header--info">Method</div>
          <div class="wf-col-header wf-col-header--info">Protocol</div>
          <div class="wf-col-header wf-col-header--info">Status</div>
          <div class="wf-col-header wf-col-header--info">Type</div>
          <div class="wf-col-header wf-col-header--info wf-col-header--size">
            Size
          </div>
          <div class="wf-col-header wf-col-header--info wf-col-header--dur">
            Duration
          </div>
          <div class="wf-col-header wf-col-header--timeline">
            <div class="wf-ruler" aria-hidden="true">${rulerHTML}</div>
            <div class="wf-grid-overlay" aria-hidden="true">
              ${gridLinesHTML}
            </div>
            <div class="wf-events-overlay" aria-hidden="true">
              ${eventLinesHTML}
            </div>
          </div>
        </div>
        <ol class="wf-list" aria-label="Network requests">
          ${rowsHTML}
        </ol>
      </div>

      <p class="wf-message wf-loading" aria-live="polite" hidden>
        Loading waterfall…
      </p>
      <p class="wf-message wf-message--error wf-error" hidden></p>`,
  );
}
