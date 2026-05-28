/**
 * Shared layout math and configuration tables.
 *
 * Single source of truth for everything that would otherwise duplicate between
 * the SSR string renderer (`render.ts`) and the runtime DOM renderer
 * (`waterfall-chart.ts`).
 *
 * Pure, DOM-free, side-effect free — runs in Node.js or the browser.
 */

import { typeConfig } from './config.js';
import { fmtMs } from './formatters.js';
import { isBlocking, resourceType } from './helpers.js';
import type { HarEntry, HarPage } from './har.js';

type HarPageTimings = HarPage['pageTimings'];

// ─────────────────────────────────────────────────────────────────────────────
// Toolbar configuration
// ─────────────────────────────────────────────────────────────────────────────

/** Phase filter buttons — used by both renderers. */
export const PHASE_BUTTONS: ReadonlyArray<
  readonly [phase: string, label: string]
> = [
  ['blocked', 'Blocked'],
  ['dns', 'DNS Lookup'],
  ['connect', 'TCP Connect'],
  ['ssl', 'TLS Handshake'],
];

export interface EventDef {
  /** CSS class suffix, e.g. `ev-dcl`. */
  key: 'ev-dcl' | 'ev-load' | 'ev-lcp';
  /** Toolbar button label. */
  label: string;
  /** Corresponding key in HarPage.pageTimings. */
  timing: 'onContentLoad' | 'onLoad' | '_lcp';
}

/** Metric-toggle button definitions in display order. */
export const EVENT_DEFS: readonly EventDef[] = [
  { key: 'ev-dcl', label: 'DOM Content Loaded', timing: 'onContentLoad' },
  { key: 'ev-load', label: 'Page Load', timing: 'onLoad' },
  { key: 'ev-lcp', label: 'Largest Contentful Paint', timing: '_lcp' },
];

/** Subset of EVENT_DEFS whose timing has a positive value in the given pageTimings. */
export function presentEvents(pt: HarPageTimings): readonly EventDef[] {
  return EVENT_DEFS.filter((e) => (pt[e.timing] ?? 0) > 0);
}

// ─────────────────────────────────────────────────────────────────────────────
// Ruler tick positions
// ─────────────────────────────────────────────────────────────────────────────

/** Return the ms positions of ruler ticks for the given total duration. */
export function tickPositions(totalMs: number): number[] {
  const targets = [50, 100, 200, 250, 500, 1000, 2000, 5000] as const;
  const interval: number = (targets.find((t) => t >= totalMs / 8) ??
    targets[targets.length - 1])!;
  const positions: number[] = [];
  for (let ms = interval; ms < totalMs; ms += interval) positions.push(ms);
  return positions;
}

// ─────────────────────────────────────────────────────────────────────────────
// Per-entry derived values
// ─────────────────────────────────────────────────────────────────────────────

/** Map an HTTP status code to its CSS status class. */
export function statusClass(status: number): 's2xx' | 's3xx' | 's4xx' | 's5xx' {
  if (status >= 500) return 's5xx';
  if (status >= 400) return 's4xx';
  if (status >= 300) return 's3xx';
  return 's2xx';
}

/** Best-effort transfer size — _transferSize when available, otherwise bodySize. */
export function entrySize(entry: HarEntry): number {
  return entry.response._transferSize ?? entry.response.bodySize;
}

/** Build the space-separated `class` attribute value for a `<li class="wf-row">`. */
export function rowClasses(
  entry: HarEntry,
  barH: number,
  extra: readonly string[] = [],
): string {
  return [
    'wf-row',
    `wf-row--rh${barH + 10}`,
    isBlocking(entry) ? 'row--blocking' : '',
    ...extra,
  ]
    .filter(Boolean)
    .join(' ');
}

/**
 * The connection phases that are present (positive value) for this entry.
 * `blocked` combines `timings.blocked` and `timings._blocked_queueing`.
 */
export function activePhasesList(entry: HarEntry): string[] {
  const t = entry.timings;
  const pairs: Array<readonly [string, number]> = [
    ['blocked', Math.max(0, (t.blocked ?? 0) + (t._blocked_queueing ?? 0))],
    ['dns', Math.max(0, t.dns)],
    ['connect', Math.max(0, t.connect)],
    ['ssl', Math.max(0, t.ssl ?? 0)],
  ];
  return pairs.filter(([, v]) => v > 0).map(([p]) => p);
}

/** Space-separated value for a row's `data-phases` attribute. */
export function phasesDataAttr(entry: HarEntry): string {
  return activePhasesList(entry).join(' ');
}

/**
 * All `data-*` values needed by `_entryFromRow()` during the progressive
 * adopt path. Returned as a record so each consumer can serialize them in its
 * own way (HTML attributes vs `el.dataset.x`).
 */
export function rowDataAttrs(entry: HarEntry): Record<string, string> {
  const t = entry.timings;
  const attrs: Record<string, string> = {
    started: entry.startedDateTime,
    time: String(entry.time),
    blocked: String(Math.max(0, t.blocked ?? 0)),
    dns: String(Math.max(0, t.dns)),
    connect: String(Math.max(0, t.connect)),
    ssl: String(Math.max(0, t.ssl ?? 0)),
    send: String(Math.max(0, t.send)),
    wait: String(Math.max(0, t.wait)),
    receive: String(Math.max(0, t.receive)),
    'body-size': String(entry.response.bodySize),
  };
  if (entry.response._transferSize !== undefined) {
    attrs['transfer-size'] = String(entry.response._transferSize);
  }
  return attrs;
}

// ─────────────────────────────────────────────────────────────────────────────
// Timeline bar layout
// ─────────────────────────────────────────────────────────────────────────────

export interface BarSegment {
  /** CSS class(es) — e.g. 'wb--blocked wb--phase' or 'wb--js-light'. */
  cls: string;
  /** Left position in percent (unrounded). */
  leftPct: number;
  /** Width in percent (unrounded). Consumers should apply `Math.max(_, 0.1)`. */
  widthPct: number;
  /** Tooltip string for the bar, already formatted. */
  tooltip: string;
}

export interface TimelineLayout {
  /** Bar segments in render order (back to front). Zero-width segments are filtered out. */
  segments: BarSegment[];
  /** Right edge of the entire bar group in percent (used as `--wf-bar-end`). */
  barEndPct: number;
  /** Formatted duration label, e.g. `123 ms`. */
  durLabel: string;
}

/**
 * Compute the bar segments and end position for a single HAR entry's timeline cell.
 *
 * The same math is used by `renderTimelineCell()` (SSR string output) and
 * `_makeTimelineCell()` (DOM nodes), guaranteeing they stay in lockstep.
 *
 * When `totalMs <= 0` the function short-circuits to an empty layout, avoiding
 * the divide-by-zero `NaN`/`Infinity` percentages that would otherwise break
 * rendering. The duration label is still computed from `entry.time`.
 */
export function computeTimelineLayout(
  entry: HarEntry,
  totalMs: number,
  originMs: number,
): TimelineLayout {
  if (totalMs <= 0) {
    return { segments: [], barEndPct: 0, durLabel: fmtMs(entry.time) };
  }

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
    ((+new Date(entry.startedDateTime) - originMs) / totalMs) * 100;

  const segments: BarSegment[] = [];

  const push = (
    cls: string,
    leftPct: number,
    widthPct: number,
    tooltip: string,
  ) => {
    if (widthPct <= 0) return;
    segments.push({ cls, leftPct, widthPct, tooltip });
  };

  const phases: Array<readonly [string, number, string]> = [
    ['wb--blocked wb--phase', blocked, 'Blocked'],
    ['wb--dns wb--phase', dns, 'DNS Lookup'],
    ['wb--connect wb--phase', connect, 'TCP Connect'],
    ['wb--ssl wb--phase', ssl, 'TLS Handshake'],
  ];

  let cursor = offsetPct;
  for (const [cls, val, label] of phases) {
    const pct = (val / totalMs) * 100;
    push(cls, cursor, pct, `${label}: ${fmtMs(val)}`);
    cursor += pct;
  }

  const resCursor =
    offsetPct + ((blocked + dns + connect + ssl) / totalMs) * 100;
  const sentPct = ((send + wait) / totalMs) * 100;
  const recvPct = (receive / totalMs) * 100;
  push(
    `wb--${key}-light`,
    resCursor,
    sentPct,
    `Send+Wait: ${fmtMs(send + wait)}`,
  );
  push(
    `wb--${key}-dark`,
    resCursor + sentPct,
    recvPct,
    `Receive: ${fmtMs(receive)}`,
  );

  const barEndPct = offsetPct + (entry.time / totalMs) * 100;
  const durLabel = fmtMs(entry.time);

  return { segments, barEndPct, durLabel };
}
