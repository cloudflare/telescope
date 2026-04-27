/**
 * Shared utilities and constants for navigation timing diagram.
 */
import type { NavigationTiming } from '../types/metrics.js';

// ── Colors ────────────────────────────────────────────────────────────────────

export const COLOR = {
  redirect: '#a0a0a0',
  dns: '#1a6b52',
  tcp: '#e07820',
  tls: '#7b3fb0',
  request: '#7dd3fc',
  response: '#3b82f6',
  ttfb: '#f59e0b',
  dom: '#fb7185',
  loadEvent: '#1e3a8a',
} as const;

// ── Coordinate helpers ────────────────────────────────────────────────────────

/**
 * Convert an absolute timestamp to a 0–100 % position along the timeline.
 */
export function toPct(ts: number, base: number, totalMs: number): number {
  return Math.max(0, Math.min(100, ((ts - base) / totalMs) * 100));
}

/**
 * Duration between two timestamps as %, clamped so it never overflows.
 */
export function durPct(
  start: number,
  end: number,
  base: number,
  totalMs: number,
): number {
  return Math.max(
    0,
    Math.min(
      100 - toPct(start, base, totalMs),
      ((end - start) / totalMs) * 100,
    ),
  );
}

// ── Type aliases ──────────────────────────────────────────────────────────────

export type NavField = keyof NavigationTiming;
export type TickField = { field: NavField; group?: string };
export type TsField = { field: NavField; note?: string };
