/**
 * Navigation Timing diagram builder.
 *
 * Converts a NavigationTiming record into all the data needed to render the
 * diagram in AllMetrics.astro — spans, ticks, legend items, and the raw
 * timestamp table.
 */
import type { NavigationTiming, NavTimingDiagram } from '../types/metrics.js';
import { toPct, durPct } from './shared.js';
import { buildFirstRequest } from './firstRequest.js';
import { buildPageLoad } from './pageLoad.js';
import { buildTimestampRows } from './timestamps.js';

/**
 * Build complete navigation timing diagram data.
 */
export function buildNavTimingDiagram(nav: NavigationTiming): NavTimingDiagram {
  const base = nav.fetchStart ?? 0;
  const totalMs = Math.max((nav.loadEventEnd ?? nav.duration ?? 0) - base, 1);
  const pct = (ts: number | undefined) =>
    ts === undefined ? 0 : toPct(ts, base, totalMs);
  const dur = (s: number, e: number) => durPct(s, e, base, totalMs);
  const relMs = (ts: number) => Math.round(ts - base);

  let laneCounter = 0;

  const firstRequest = buildFirstRequest({
    nav,
    base,
    totalMs,
    pct,
    dur,
    relMs,
    laneCounter,
  });
  laneCounter = firstRequest.frTicks.length;

  const pageLoad = buildPageLoad({
    nav,
    base,
    totalMs,
    pct,
    dur,
    relMs,
    laneCounter,
  });

  const navTimestampRows = buildTimestampRows({
    nav,
    ttfbField: firstRequest.ttfbField as keyof NavigationTiming,
    relMs,
  });

  return {
    totalMs,
    frTicks: firstRequest.frTicks,
    pageTicks: pageLoad.pageTicks,
    frSpans: firstRequest.frSpans,
    pageSegs: pageLoad.pageSegs,
    frLegend: firstRequest.frLegend,
    pageLegend: pageLoad.pageLegend,
    ttfbMarker: firstRequest.ttfbMarker,
    ttfbField: firstRequest.ttfbField,
    hasFuzzyDom: pageLoad.hasFuzzyDom,
    navTimestampRows,
  };
}
