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
 */

import { typeConfig, TYPE_SWATCH, TYPE_LABEL } from './config.js';
import { fmtSize, fmtMs } from './formatters.js';
import {
  parseUrl,
  resourceType,
  isBlocking,
  computeTotalMs,
  uniqueTypes,
  pageEvents,
  fmtEventLabel,
} from './helpers.js';
import type { Har, HarEntry, HarPage } from './har.js';

type HarPageTimings = HarPage['pageTimings'];

// ─────────────────────────────────────────────────────────────────────────────
// HTML escaping
// ─────────────────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─────────────────────────────────────────────────────────────────────────────
// Legend
// ─────────────────────────────────────────────────────────────────────────────

const typeLabel = (t: string): string => TYPE_LABEL[t] ?? t;

// ───────────────────────────��─────────────────────────────────────────────────
// Toolbar (filter chips + toggle button)
// ─────────────────────────────────────────────────────────────────────────────

function renderToolbar(types: string[], pageTimings: HarPageTimings): string {
  const chips = types
    .map((t, i) => {
      const key = TYPE_SWATCH[t];
      const swatch = key
        ? `<span class="wf-swatch wf-swatch--thick wf-swatch--${key}"></span>`
        : '';
      return `<button class="wf-filter-btn${i === 0 ? ' active' : ''}">${swatch}${esc(typeLabel(t))}</button>`;
    })
    .join('\n    ');

  const phaseBtn = (key: string, label: string) =>
    `<button class="wf-filter-btn" data-phase="${key}"><span class="wf-swatch wf-swatch--thin wf-swatch--${key}"></span>${esc(label)}</button>`;
  const eventBtn = (key: string, label: string) =>
    `<button class="wf-filter-btn active" data-event="${key}"><span class="wf-swatch wf-swatch--thin wf-swatch--${key}"></span>${esc(label)}</button>`;

  const eventBtns: string[] = [];
  if ((pageTimings.onContentLoad ?? 0) > 0)
    eventBtns.push(eventBtn('ev-dcl', 'DOM Content Loaded'));
  if ((pageTimings.onLoad ?? 0) > 0)
    eventBtns.push(eventBtn('ev-load', 'Page Load'));
  if ((pageTimings._lcp ?? 0) > 0)
    eventBtns.push(eventBtn('ev-lcp', 'Largest Contentful Paint'));

  const metricsGroup =
    eventBtns.length > 0
      ? `<div class="wf-legend-group" role="group" aria-label="Toggle metrics">
    ${eventBtns.join('\n    ')}
  </div>`
      : '';

  return `
<div class="wf-toolbar">
  <div class="wf-legend-group wf-filters" role="group" aria-label="Filter by resource type">
    ${chips}
  </div>
  <div class="wf-legend-group" role="group" aria-label="Filter by connection phase">
    ${phaseBtn('blocked', 'Blocked')}
    ${phaseBtn('dns', 'DNS Lookup')}
    ${phaseBtn('connect', 'TCP Connect')}
    ${phaseBtn('ssl', 'TLS Handshake')}
  </div>
  ${metricsGroup}
</div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Ruler
// ─────────────────────────────────────────────────────────────────────────────

function tickPositions(totalMs: number): number[] {
  const targets = [50, 100, 200, 250, 500, 1000, 2000, 5000] as const;
  const interval: number = (targets.find((t) => t >= totalMs / 8) ??
    targets[targets.length - 1])!;
  const positions: number[] = [];
  for (let ms = interval; ms < totalMs; ms += interval) positions.push(ms);
  return positions;
}

function renderRuler(totalMs: number): string {
  return tickPositions(totalMs)
    .map((ms) => {
      const label = `${parseFloat((ms / 1000).toFixed(3))}s`;
      return `<span class="wf-tick" style="left:${((ms / totalMs) * 100).toFixed(4)}%">${esc(label)}</span>`;
    })
    .join('\n      ');
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

function renderGridLines(totalMs: number): string {
  return tickPositions(totalMs)
    .map((ms) => {
      const leftPct = ((ms / totalMs) * 100).toFixed(4);
      return `<div class="wf-grid-line" style="left:${leftPct}%"></div>`;
    })
    .join('\n      ');
}

function renderEventLines(
  pageTimings: HarPageTimings,
  totalMs: number,
): string {
  return pageEvents(pageTimings, totalMs)
    .map(({ ms, cls, label }) => {
      const leftPct = ((ms / totalMs) * 100).toFixed(4);
      const dataLabel = fmtEventLabel(label, ms);
      return `<div class="wf-event-line ${cls}" data-ms="${ms}" data-label="${esc(dataLabel)}" data-name="${esc(label)}" style="left:${leftPct}%"></div>`;
    })
    .join('\n      ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline bar cell for one entry
// ─────────────────────────────────────────────────────────────────────────────

function renderTimelineCell(
  entry: HarEntry,
  totalMs: number,
  originMs: number,
): string {
  const type = resourceType(entry);
  const { key } = typeConfig(type);
  const t = entry.timings;
  const blocked = Math.max(0, (t.blocked ?? 0) + (t._blocked_queueing ?? 0));
  const dns = Math.max(0, t.dns);
  const connect = Math.max(0, t.connect);
  const ssl = Math.max(0, t.ssl ?? 0);
  const send = Math.max(0, t.send);
  const wait = Math.max(0, t.wait);
  const receive = Math.max(0, t.receive);
  const offsetPct =
    totalMs > 0
      ? ((+new Date(entry.startedDateTime) - originMs) / totalMs) * 100
      : 0;

  const bars: string[] = [];

  // Only left and width are set via inline style — all heights come from CSS.
  const addBar = (
    cls: string,
    leftPct: number,
    widthPct: number,
    tooltip: string,
  ) => {
    if (widthPct <= 0) return;
    bars.push(
      `<div class="wb ${cls}" title="${esc(tooltip)}" style="left:${leftPct.toFixed(4)}%;width:${Math.max(widthPct, 0.1).toFixed(4)}%"></div>`,
    );
  };

  const phases: Array<[string, number, string]> = [
    ['wb--blocked wb--phase', blocked, 'Blocked'],
    ['wb--dns wb--phase', dns, 'DNS Lookup'],
    ['wb--connect wb--phase', connect, 'TCP Connect'],
    ['wb--ssl wb--phase', ssl, 'TLS Handshake'],
  ];

  let cursor = offsetPct;
  for (const [cls, val, label] of phases) {
    const pct = (val / totalMs) * 100;
    addBar(cls, cursor, pct, `${label}: ${fmtMs(val)}`);
    cursor += pct;
  }

  const resCursor =
    offsetPct + ((blocked + dns + connect + ssl) / totalMs) * 100;
  const sentPct = ((send + wait) / totalMs) * 100;
  const recvPct = (receive / totalMs) * 100;
  addBar(
    `wb--${key}-light`,
    resCursor,
    sentPct,
    `Send+Wait: ${fmtMs(send + wait)}`,
  );
  addBar(
    `wb--${key}-dark`,
    resCursor + sentPct,
    recvPct,
    `Receive: ${fmtMs(receive)}`,
  );

  const barEndPct = (offsetPct + (entry.time / totalMs) * 100).toFixed(4);
  const durLabel = fmtMs(entry.time);
  return `<span class="wf-cell wf-cell--timeline" style="--wf-bar-end:${barEndPct}%">
        <div class="wf-bar-wrap">
          ${bars.join('\n          ')}
          <span class="wf-bar-dur">${esc(durLabel)}</span>
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
): string {
  const type = resourceType(entry);
  const { barH } = typeConfig(type);
  const rowH = barH + 10;
  const status = entry.response.status;
  const transferSize = entry.response._transferSize;
  const size = transferSize ?? entry.response.bodySize;
  const { domain, path } = parseUrl(entry.request.url);
  const t = entry.timings;

  const statusCls =
    status >= 500
      ? 's5xx'
      : status >= 400
        ? 's4xx'
        : status >= 300
          ? 's3xx'
          : 's2xx';

  const rowClasses = [
    'wf-row',
    `wf-row--rh${rowH}`,
    isBlocking(entry) ? 'row--blocking' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const pathCell = path ? `<span class="wf-url-path">${esc(path)}</span>` : '';

  // data-* attributes encode all values needed by _entryFromRow() in the
  // web component's adopt path, so interactivity works without re-fetching HAR.
  const dataAttrs = [
    `data-index="${index}"`,
    `data-started="${esc(entry.startedDateTime)}"`,
    `data-time="${entry.time}"`,
    `data-blocked="${Math.max(0, t.blocked ?? 0)}"`,
    `data-dns="${Math.max(0, t.dns)}"`,
    `data-connect="${Math.max(0, t.connect)}"`,
    `data-ssl="${Math.max(0, t.ssl ?? 0)}"`,
    `data-send="${Math.max(0, t.send)}"`,
    `data-wait="${Math.max(0, t.wait)}"`,
    `data-receive="${Math.max(0, t.receive)}"`,
    `data-body-size="${entry.response.bodySize}"`,
    ...(transferSize !== undefined
      ? [`data-transfer-size="${transferSize}"`]
      : []),
  ].join(' ');

  return `<li class="${rowClasses}" ${dataAttrs}>
      <span class="wf-cell wf-cell--idx">${visIdx}</span>
      <span class="wf-cell wf-cell--url" title="${esc(entry.request.url)}"><span class="wf-url-domain">${esc(domain)}</span>${pathCell}</span>
      <span class="wf-cell wf-cell--info">${esc(entry.request.method)}</span>
      <span class="wf-cell wf-cell--info">${esc(entry.request.httpVersion)}</span>
      <span class="wf-cell wf-cell--info wf-cell--stat ${statusCls}">${status}</span>
      <span class="wf-cell wf-cell--info">${esc(type)}</span>
      <span class="wf-cell wf-cell--info wf-cell--size">${esc(fmtSize(size))}</span>
      <span class="wf-cell wf-cell--info wf-cell--dur">${esc(fmtMs(entry.time))}</span>
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
  const rowsHTML = entries
    .map((entry, i) => renderRow(entry, i, i + 1, totalMs, originMs))
    .join('\n    ');

  return `
${renderToolbar(types, pageTimings)}

<div class="wf-list-wrap">
  <div class="wf-col-headers" aria-hidden="true">
    <div class="wf-col-header wf-col-header--idx">#</div>
    <div class="wf-col-header wf-col-header--url">URL</div>
    <div class="wf-col-header wf-col-header--info">Method</div>
    <div class="wf-col-header wf-col-header--info">Protocol</div>
    <div class="wf-col-header wf-col-header--info">Status</div>
    <div class="wf-col-header wf-col-header--info">Type</div>
    <div class="wf-col-header wf-col-header--info wf-col-header--size">Size</div>
    <div class="wf-col-header wf-col-header--info wf-col-header--dur">Duration</div>
    <div class="wf-col-header wf-col-header--timeline">
      <div class="wf-ruler" aria-hidden="true">
        ${rulerHTML}
      </div>
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

<p class="wf-message wf-loading" aria-live="polite" hidden>Loading waterfall\u2026</p>
<p class="wf-message wf-message--error wf-error" hidden></p>
`.trim();
}
