/**
 * Navigation Timing diagram builder.
 *
 * Converts a NavigationTiming record into all the data needed to render the
 * diagram in AllMetrics.astro — spans, ticks, legend items, and the raw
 * timestamp table.  Keeping this out of the component makes it testable and
 * keeps the Astro frontmatter thin.
 */
import type {
  NavigationTiming,
  DiagramTick,
  DiagramSpan,
  DiagramPageSeg,
  DiagramLegendItem,
  NavTimingDiagram,
} from '../types/metrics.js';
import { selectTtfbField } from './extractors.js';

// ── Colours ───────────────────────────────────────────────────────────────────

const COLOR = {
  redirect: '#a0a0a0',
  dns: '#1a6b52',
  tcp: '#e07820',
  tls: '#7b3fb0',
  request: '#c8b432',
  response: '#3b82f6',
  ttfb: '#f59e0b',
  dom: '#fb7185', // pink  (was teal — swapped with Load Event)
  loadEvent: '#2a9d8f', // teal  (was pink — swapped with DOM)
} as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Convert an absolute timestamp to a 0–100 % position along the timeline. */
function toPct(ts: number, base: number, totalMs: number): number {
  return Math.max(0, Math.min(100, ((ts - base) / totalMs) * 100));
}

/** Duration between two timestamps as %, clamped so it never overflows. */
function durPct(s: number, e: number, base: number, totalMs: number): number {
  return Math.max(
    0,
    Math.min(100 - toPct(s, base, totalMs), ((e - s) / totalMs) * 100),
  );
}

// ── Main builder ──────────────────────────────────────────────────────────────

export function buildNavTimingDiagram(nav: NavigationTiming): NavTimingDiagram {
  const base = nav.fetchStart ?? 0;
  const totalMs = Math.max((nav.loadEventEnd ?? nav.duration ?? 0) - base, 1);
  const pct = (ts: number | undefined) =>
    ts === undefined ? 0 : toPct(ts, base, totalMs);
  const dur = (s: number, e: number) => durPct(s, e, base, totalMs);

  const hasRedirect = (nav.redirectEnd ?? 0) > (nav.redirectStart ?? 0);
  const hasTls = (nav.secureConnectionStart ?? 0) > 0;
  const ttfbField = selectTtfbField(nav);

  // ── First-request spans ────────────────────────────────────────────────────

  const frSpans: DiagramSpan[] = [];

  function addSpan(
    label: string,
    s: number | undefined,
    e: number | undefined,
    color: string,
  ) {
    if (s === undefined || e === undefined || e <= s) return;
    frSpans.push({
      label,
      ms: Math.round(e - s),
      leftPct: pct(s),
      widthPct: dur(s, e),
      color,
    });
  }

  const tcpEnd = hasTls ? nav.secureConnectionStart : nav.connectEnd;
  if (hasRedirect)
    addSpan('Redirect', nav.redirectStart, nav.redirectEnd, COLOR.redirect);
  addSpan('DNS', nav.domainLookupStart, nav.domainLookupEnd, COLOR.dns);
  addSpan('TCP', nav.connectStart, tcpEnd, COLOR.tcp);
  if (hasTls)
    addSpan('TLS', nav.secureConnectionStart, nav.connectEnd, COLOR.tls);
  addSpan('Request', nav.requestStart, nav.responseStart, COLOR.request);
  addSpan('Response', nav.responseStart, nav.responseEnd, COLOR.response);

  // ── First-request ticks ────────────────────────────────────────────────────

  const frTicks: DiagramTick[] = [];
  let laneCounter = 0;

  const frTickFields: { field: string; group?: string }[] = [
    { field: 'fetchStart' },
    ...(hasRedirect
      ? [
          { field: 'redirectStart', group: 'Redirect' },
          { field: 'redirectEnd', group: 'Redirect' },
        ]
      : []),
    { field: 'domainLookupStart', group: 'DNS' },
    { field: 'domainLookupEnd', group: 'DNS' },
    { field: 'connectStart', group: 'TCP' },
    ...(hasTls ? [{ field: 'secureConnectionStart', group: 'TLS' }] : []),
    { field: 'connectEnd', group: hasTls ? 'TLS' : 'TCP' },
    { field: 'requestStart', group: 'Request' },
    { field: 'responseStart', group: 'Response' },
    { field: 'responseEnd', group: 'Response' },
  ];

  for (const { field, group } of frTickFields) {
    const ts = nav[field as keyof NavigationTiming] as number | undefined;
    if (ts === undefined) continue;
    const leftPct = pct(ts);
    frTicks.push({
      field,
      leftPct,
      msRel: Math.round(ts - base),
      lane: laneCounter++ % 4,
      align: leftPct > 75 ? 'right' : 'left',
      group,
    });
  }

  // TTFB tick — amber, always shown (pushed directly, bypasses dedup)
  const ttfbTs = nav[ttfbField as keyof NavigationTiming] as number | undefined;
  const ttfbMs = ttfbTs !== undefined ? Math.round(ttfbTs - base) : 0;
  let ttfbMarker: { leftPct: number; ms: number } | null = null;
  if (ttfbTs !== undefined) {
    const ttfbLeftPct = pct(ttfbTs);
    ttfbMarker = { leftPct: ttfbLeftPct, ms: ttfbMs };
    frTicks.push({
      field: `TTFB (${ttfbField})`,
      leftPct: ttfbLeftPct,
      msRel: ttfbMs,
      lane: laneCounter++ % 4,
      align: ttfbLeftPct > 75 ? 'right' : 'left',
      color: COLOR.ttfb,
      group: 'TTFB',
    });
  }

  const frLegend: DiagramLegendItem[] = [
    ...frSpans.map(s => ({ label: s.label, ms: s.ms, color: s.color })),
    {
      label: 'TTFB',
      ms: ttfbMs,
      color: COLOR.ttfb,
      secondary: `(via ${ttfbField})`,
    },
  ];

  // ── Page-scoped segments ───────────────────────────────────────────────────

  const pageSegs: DiagramPageSeg[] = [];
  const pageLegend: DiagramLegendItem[] = [];
  let hasFuzzyDom = false;

  if (
    nav.responseStart !== undefined &&
    nav.domComplete !== undefined &&
    nav.domComplete > nav.responseStart
  ) {
    const domMs = Math.round(nav.domComplete - nav.responseStart);
    const fuzzyEndTs = nav.responseEnd ?? nav.responseStart;
    const fuzzyFrac =
      nav.domComplete > fuzzyEndTs
        ? ((fuzzyEndTs - nav.responseStart) /
            (nav.domComplete - nav.responseStart)) *
          100
        : 0;
    hasFuzzyDom = fuzzyFrac > 0;

    const c = COLOR.dom;
    const rgb = '251,113,133'; // matches #fb7185
    const domBg = hasFuzzyDom
      ? `linear-gradient(to right, rgba(${rgb},0) 0%, rgba(${rgb},0.45) ${(fuzzyFrac * 0.5).toFixed(1)}%, ${c} ${fuzzyFrac.toFixed(1)}%, ${c} 100%)`
      : c;

    pageSegs.push({
      label: 'DOM',
      ms: domMs,
      leftPct: pct(nav.responseStart),
      widthPct: dur(nav.responseStart, nav.domComplete),
      bg: domBg,
    });
    pageLegend.push({
      label: 'DOM',
      ms: domMs,
      color: c,
      note: hasFuzzyDom ? '*' : undefined,
    });
  }

  if (
    nav.loadEventStart !== undefined &&
    nav.loadEventEnd !== undefined &&
    nav.loadEventEnd > nav.loadEventStart
  ) {
    const leMs = Math.round(nav.loadEventEnd - nav.loadEventStart);
    pageSegs.push({
      label: 'Load Event',
      ms: leMs,
      leftPct: pct(nav.loadEventStart),
      widthPct: dur(nav.loadEventStart, nav.loadEventEnd),
      bg: COLOR.loadEvent,
    });
    pageLegend.push({ label: 'Load Event', ms: leMs, color: COLOR.loadEvent });
  }

  // ── Page-scoped ticks ──────────────────────────────────────────────────────

  const pageTicks: DiagramTick[] = [];
  const seenPcts = new Set<string>();

  const pageTickFields: { field: string; group: string }[] = [
    { field: 'domInteractive', group: 'DOM' },
    { field: 'domContentLoadedEventStart', group: 'DOM' },
    { field: 'domContentLoadedEventEnd', group: 'DOM' },
    { field: 'domComplete', group: 'DOM' },
    { field: 'loadEventStart', group: 'Load Event' },
    { field: 'loadEventEnd', group: 'Load Event' },
  ];

  for (const { field, group } of pageTickFields) {
    const ts = nav[field as keyof NavigationTiming] as number | undefined;
    if (ts === undefined || ts <= 0) continue;
    const leftPct = pct(ts);
    const key = leftPct.toFixed(2);
    if (seenPcts.has(key)) continue;
    seenPcts.add(key);
    pageTicks.push({
      field,
      leftPct,
      msRel: Math.round(ts - base),
      lane: laneCounter++ % 4,
      align: leftPct > 75 ? 'right' : 'left',
      group,
    });
  }

  // ── Raw timestamp table ────────────────────────────────────────────────────

  const tsFieldDefs: { field: string; note?: string }[] = [
    { field: 'fetchStart' },
    { field: 'redirectStart' },
    { field: 'redirectEnd' },
    { field: 'domainLookupStart' },
    { field: 'domainLookupEnd' },
    { field: 'connectStart' },
    { field: 'secureConnectionStart' },
    { field: 'connectEnd' },
    { field: 'requestStart' },
    { field: ttfbField, note: 'used for TTFB' },
    ...(ttfbField !== 'responseStart' ? [{ field: 'responseStart' }] : []),
    { field: 'responseEnd' },
    { field: 'domInteractive' },
    { field: 'domContentLoadedEventStart' },
    { field: 'domContentLoadedEventEnd' },
    { field: 'domComplete' },
    { field: 'loadEventStart' },
    { field: 'loadEventEnd' },
  ];

  const navTimestampRows = tsFieldDefs
    .map(({ field, note }) => {
      const ms = nav[field as keyof NavigationTiming] as number | undefined;
      return ms !== undefined && ms > 0
        ? { field, msRel: Math.round(ms - base), note }
        : null;
    })
    .filter((r): r is NonNullable<typeof r> => r !== null);

  return {
    totalMs,
    frTicks,
    pageTicks,
    frSpans,
    pageSegs,
    frLegend,
    pageLegend,
    ttfbMarker,
    ttfbField,
    hasFuzzyDom,
    navTimestampRows,
  };
}
