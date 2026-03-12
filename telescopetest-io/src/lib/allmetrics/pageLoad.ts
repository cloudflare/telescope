/**
 * Page Load section of navigation timing diagram.
 * Handles DOM parsing, DOMContentLoaded, and Load events.
 */
import type {
  NavigationTiming,
  DiagramTick,
  DiagramPageSeg,
  DiagramLegendItem,
} from '../types/metrics.js';
import { COLOR, type TickField } from './shared.js';

// ── Field definitions ─────────────────────────────────────────────────────────

const PAGE_TICK_FIELDS: TickField[] = [
  { field: 'domInteractive' },
  { field: 'domContentLoadedEventStart', group: 'DCL' },
  { field: 'domContentLoadedEventEnd' },
  { field: 'domComplete' },
  { field: 'loadEventStart', group: 'Page Load' },
  { field: 'loadEventEnd' },
];

// ── Main builder ──────────────────────────────────────────────────────────────

export type PageLoadData = {
  pageSegs: DiagramPageSeg[];
  pageTicks: DiagramTick[];
  pageLegend: DiagramLegendItem[];
  hasFuzzyDom: boolean;
};

export type PageLoadContext = {
  nav: NavigationTiming;
  base: number;
  totalMs: number;
  pct: (ts: number | undefined) => number;
  dur: (s: number, e: number) => number;
  relMs: (ts: number) => number;
  laneCounter: number;
};

/**
 * Build all data for the Page Load section.
 */
export function buildPageLoad(ctx: PageLoadContext): PageLoadData {
  const { nav, pct, dur, relMs } = ctx;

  const pageSegs: DiagramPageSeg[] = [];
  const pageLegend: DiagramLegendItem[] = [];
  let hasFuzzyDom = false;

  // ── DCL (DOMContentLoaded) segment ─────────────────────────────────────────

  if (
    nav.responseStart !== undefined &&
    nav.domComplete !== undefined &&
    nav.domComplete > nav.responseStart
  ) {
    const dclStartMs = relMs(nav.domContentLoadedEventStart);
    const fuzzyEndTs = nav.responseEnd ?? nav.responseStart;
    const fuzzyFrac =
      nav.domComplete > fuzzyEndTs
        ? ((fuzzyEndTs - nav.responseStart) /
            (nav.domComplete - nav.responseStart)) *
          100
        : 0;
    hasFuzzyDom = fuzzyFrac > 0;
    const rgb = '251,113,133'; // matches COLOR.dom = #fb7185
    const domBg = hasFuzzyDom
      ? `linear-gradient(to right, rgba(${rgb},0) 0%, rgba(${rgb},0.45) ${(fuzzyFrac * 0.5).toFixed(1)}%, ${COLOR.dom} ${fuzzyFrac.toFixed(1)}%, ${COLOR.dom} 100%)`
      : COLOR.dom;
    pageSegs.push({
      label: 'DCL (domContentLoadedEventStart)',
      ms: dclStartMs,
      leftPct: pct(nav.responseStart),
      widthPct: dur(nav.responseStart, nav.domContentLoadedEventStart),
      bg: domBg,
    });
    pageLegend.push({
      label: 'DCL',
      ms: dclStartMs,
      color: COLOR.dom,
      secondary: '(via domContentLoadedEventStart)',
      note: hasFuzzyDom ? '*' : undefined,
    });
  }

  // ── Page Load segment ──────────────────────────────────────────────────────

  if (
    nav.loadEventStart !== undefined &&
    nav.loadEventEnd !== undefined &&
    nav.loadEventEnd > nav.loadEventStart
  ) {
    const leMs = relMs(nav.loadEventStart);
    pageSegs.push({
      label: 'Page Load (loadEventStart)',
      ms: leMs,
      leftPct: pct(nav.loadEventStart),
      widthPct: dur(nav.loadEventStart, nav.loadEventEnd),
      bg: COLOR.loadEvent,
    });
    pageLegend.push({
      label: 'Page Load',
      ms: leMs,
      color: COLOR.loadEvent,
      secondary: '(via loadEventStart)',
    });
  }

  // ── Ticks (vertical markers) ───────────────────────────────────────────────

  const pageTicks: DiagramTick[] = [];
  for (const { field, group } of PAGE_TICK_FIELDS) {
    const ts = nav[field] as number | undefined;
    if (ts === undefined || ts <= 0) continue;
    const leftPct = pct(ts);
    let align: 'left' | 'right' = 'left';
    if (leftPct > 75) {
      align = 'right';
    }

    let displayField: string = field;
    if (field === 'domContentLoadedEventStart') {
      displayField = 'DCL (domContentLoadedEventStart)';
    } else if (field === 'loadEventStart') {
      displayField = 'Page Load (loadEventStart)';
    }

    let color: string | undefined = undefined;
    if (field === 'domContentLoadedEventStart') {
      color = COLOR.dom;
    } else if (field === 'loadEventStart') {
      color = COLOR.loadEvent;
    }

    pageTicks.push({
      field: displayField,
      leftPct,
      msRel: relMs(ts),
      lane: ctx.laneCounter++ % 4,
      align,
      group,
      color,
    });
  }

  return {
    pageSegs,
    pageTicks,
    pageLegend,
    hasFuzzyDom,
  };
}
