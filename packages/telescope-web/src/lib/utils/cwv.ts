/**
 * Core Web Vitals — LCP and CLS.
 *
 * The official CWV set (as of 2024) is LCP, CLS, and INP.
 * INP requires Event Timing API instrumentation that Telescope does not
 * currently collect, so only LCP and CLS are computed here.
 *
 * FCP and TTFB are diagnostic metrics with published thresholds but are NOT
 * Core Web Vitals — they live in extractors.ts alongside other scalar extractions.
 *
 * ── LCP (Largest Contentful Paint) ──────────────────────────────────────────
 * Source: metrics.largestContentfulPaint[]
 *
 * The browser fires a stream of LCP PerformanceEntry candidates as the page
 * loads. Each new element that paints larger than the previous candidate
 * replaces it. Reporting stops when the user first interacts (scroll, click,
 * key) or the page is hidden. The LAST entry in the array is therefore the
 * final settled value.
 *
 * We use renderTime when available (the actual timestamp the element was
 * painted to screen). For cross-origin images the browser zeros renderTime
 * for privacy, so we fall back to startTime in that case.
 *
 * ── CLS (Cumulative Layout Shift) ────────────────────────────────────────────
 * Source: metrics.layoutShifts[]
 *
 * Each entry is one layout-shift PerformanceEntry with a `value` between 0–1
 * representing the fraction of the viewport that shifted. The CLS score is
 * computed from "session windows": consecutive shifts within 1 s of each other
 * and no more than 5 s total are grouped; the score is the maximum window sum.
 *
 * Telescope collects raw shift entries, not pre-grouped windows. We sum all
 * entries where hadRecentInput is false — shifts caused by user input (click,
 * tap, keypress) are excluded from the score because they are expected and
 * intentional. This is a reasonable approximation of the true session-window
 * score; it over-counts only when there are long pauses between shifts that
 * would otherwise fall into separate windows.
 */

import type { MetricsJson } from '../types/metrics.js';
import { type Rating, getLcpRating, getClsRating } from './ratings.js';
import { formatMs, formatDecimal } from './formatters.js';

export type CwvMetric = {
  /** Raw numeric value — undefined if the data is missing */
  value: number | undefined;
  /** Pre-formatted string for display, or null when unavailable */
  formatted: string | null;
  /** Rating band, or undefined when value is unavailable */
  rating: Rating | undefined;
};

/**
 * Largest Contentful Paint in milliseconds.
 * Returns the final settled LCP candidate (last entry in the array).
 */
export function getLcp(metrics: MetricsJson | null): CwvMetric {
  const entries = metrics?.largestContentfulPaint;
  if (!entries?.length)
    return { value: undefined, formatted: null, rating: undefined };
  const last = entries[entries.length - 1];
  // renderTime is zeroed for cross-origin images; fall back to startTime
  const value =
    last.renderTime && last.renderTime > 0 ? last.renderTime : last.startTime;
  return { value, formatted: formatMs(value), rating: getLcpRating(value) };
}

/**
 * Cumulative Layout Shift score (unitless, 0–1+).
 * Sums all non-input-triggered shift values as an approximation of the
 * session-window score.
 */
export function getCls(metrics: MetricsJson | null): CwvMetric {
  const shifts = metrics?.layoutShifts;
  if (!shifts) return { value: undefined, formatted: null, rating: undefined };
  const value = shifts
    .filter(s => !s.hadRecentInput)
    .reduce((sum, s) => sum + (s.value ?? 0), 0);
  return {
    value,
    formatted: formatDecimal(value),
    rating: getClsRating(value),
  };
}
