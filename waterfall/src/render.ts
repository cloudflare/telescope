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

import { typeConfig } from './config.js';
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

function renderLegend(): string {
  const swatch = (thin: boolean, key: string) =>
    `<span class="wf-swatch wf-swatch--${thin ? 'thin' : 'thick'} wf-swatch--${key}"></span>`;

  const item = (thin: boolean, key: string, label: string) =>
    `<span class="wf-legend-item">${swatch(thin, key)}${esc(label)}</span>`;

  return `
<div class="wf-legend" aria-label="Waterfall chart legend">
  <div class="wf-legend-row">
    <span class="wf-legend-heading">Connection phases</span>
    ${item(true, 'blocked', 'Blocked')}
    ${item(true, 'dns', 'DNS')}
    ${item(true, 'connect', 'Connect')}
    ${item(true, 'ssl', 'SSL')}
    ${item(true, 'send', 'Send')}
    ${item(true, 'wait', 'Wait')}
  </div>
  <div class="wf-legend-row">
    <span class="wf-legend-heading">File type <span class="wf-legend-note">(light\u00a0=\u00a0sent \u00b7 dark\u00a0=\u00a0received)</span></span>
    ${item(false, 'html', 'HTML')}
    ${item(false, 'js', 'JS')}
    ${item(false, 'css', 'CSS')}
    ${item(false, 'image', 'Image')}
    ${item(false, 'font', 'Font')}
    ${item(false, 'video', 'Video')}
    ${item(false, 'other', 'Other')}
  </div>
  <div class="wf-legend-row">
    <span class="wf-legend-heading">Events</span>
    ${item(true, 'ev-dcl', 'DCL')}
    ${item(true, 'ev-load', 'Load')}
  </div>
</div>`.trim();
}

// ───────────────────────────��─────────────────────────────────────────────────
// Toolbar (filter chips + toggle button)
// ─────────────────────────────────────────────────────────────────────────────

function renderToolbar(types: string[]): string {
  const chips = types
    .map(
      (t, i) =>
        `<button class="wf-filter-btn${i === 0 ? ' active' : ''}">${esc(t)}</button>`,
    )
    .join('\n    ');

  return `
<div class="wf-toolbar">
  <div class="wf-filters" role="group" aria-label="Filter by resource type">
    ${chips}
  </div>
  <button class="wf-toggle-cols" aria-expanded="false">Show columns</button>
</div>`.trim();
}

// ─────────────────────────────────────────────────────────────────────────────
// Ruler
// ─────────────────────────────────────────────────────────────────────────────

function renderRuler(totalMs: number): string {
  const targets = [50, 100, 200, 250, 500, 1000, 2000, 5000] as const;
  const interval: number = (targets.find((t) => t >= totalMs / 8) ??
    targets[targets.length - 1])!;
  const ticks: string[] = [];
  for (let ms = interval; ms < totalMs; ms += interval) {
    const label =
      ms >= 1000
        ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
        : `${ms}ms`;
    ticks.push(
      `<span class="wf-tick" style="left:${((ms / totalMs) * 100).toFixed(4)}%">${esc(label)}</span>`,
    );
  }
  return ticks.join('\n      ');
}

// ─────────────────────────────────────────────────────────────────────────────
// Event lines overlay
// Event lines are positioned as percentages of the overlay width.
// The JS upgrade path re-positions them in pixels via ResizeObserver.
// ─────────────────────────────────────────────────────────────────────────────

function renderEventLines(
  pageTimings: HarPageTimings,
  totalMs: number,
): string {
  const lines = pageEvents(pageTimings, totalMs)
    .map(({ ms, cls, label }) => {
      const pct = ((ms / totalMs) * 100).toFixed(4);
      return `<div class="wf-event-line ${cls}" data-label="${esc(fmtEventLabel(label, ms))}" style="left:${pct}%"></div>`;
    })
    .join('\n    ');
  return lines;
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
    ['wb--ssl wb--phase', ssl, 'SSL Handshake'],
    ['wb--send wb--phase', send, 'Send'],
    ['wb--wait wb--phase', wait, 'Wait (TTFB)'],
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

  return `<span class="wf-cell wf-cell--timeline">
        <div class="wf-bar-wrap">
          ${bars.join('\n          ')}
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
      <span class="wf-cell wf-cell--url" title="${esc(entry.request.url)}">
        <span class="wf-url-domain">${esc(domain)}</span>
        ${pathCell}
      </span>
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
 * import { renderToHTML } from '@telescope/waterfall';
 * const html = renderToHTML(har);
 * fs.writeFileSync('waterfall.html', `<waterfall-chart>${html}</waterfall-chart>`);
 *
 * @example
 * // SSR (e.g. Astro)
 * ---
 * import { renderToHTML } from '@telescope/waterfall';
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

  // Event lines
  const eventLinesHTML = renderEventLines(pageTimings, totalMs);

  // Request rows
  let visIdx = 0;
  const rowsHTML = entries
    .map((entry, i) => {
      visIdx++;
      return renderRow(entry, i, visIdx, totalMs, originMs);
    })
    .join('\n    ');

  return `
${renderLegend()}

${renderToolbar(types)}

<div class="wf-list-wrap">
  <div class="wf-events-overlay" aria-hidden="true">
    ${eventLinesHTML}
  </div>
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
