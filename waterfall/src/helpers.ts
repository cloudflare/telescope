/**
 * Pure analysis helpers for HAR waterfall rendering.
 * All functions are side-effect free and browser/Node compatible.
 */

import type { HarEntry, HarPage } from './har.js';

type HarPageTimings = HarPage['pageTimings'];

// ── URL ──────────────────────────────────────────────────────────────────────

export function parseUrl(raw: string): { domain: string; path: string } {
  try {
    const u = new URL(raw);
    let path = u.pathname;
    if (path.length > 36) path = '…' + path.slice(-34);
    return { domain: u.hostname, path: path === '/' ? '' : path };
  } catch {
    return { domain: raw.slice(0, 36), path: '' };
  }
}

// ── Resource type ─────────────────────────────────────────────────────────────

const TYPE_REMAP: Record<string, string> = {
  document: 'html',
  script: 'js',
  stylesheet: 'css',
};

export function resourceType(entry: HarEntry): string {
  if (entry._resourceType)
    return TYPE_REMAP[entry._resourceType] ?? entry._resourceType;
  const m = entry.response.content.mimeType;
  if (m.includes('html')) return 'html';
  if (m.includes('javascript') || m.includes('ecmascript')) return 'js';
  if (m.includes('css')) return 'css';
  if (m.includes('image')) return 'image';
  if (m.includes('font')) return 'font';
  if (m.includes('video')) return 'video';
  return 'other';
}

// ── Blocking ──────────────────────────────────────────────────────────────────

/** True when a request was queued/blocked for more than 100 ms. */
export function isBlocking(entry: HarEntry): boolean {
  const t = entry.timings;
  return (
    Math.max(0, t.blocked ?? 0) + Math.max(0, t._blocked_queueing ?? 0) > 100
  );
}

/**
 * Total waterfall duration in ms — from the first request start to the last
 * request end, relative to the first entry's startedDateTime.
 */
export function computeTotalMs(entries: HarEntry[]): number {
  const origin = +new Date(entries[0]!.startedDateTime);
  return entries.reduce((max, e) => {
    const end = +new Date(e.startedDateTime) - origin + e.time;
    return end > max ? end : max;
  }, 0);
}

const TYPE_ORDER = ['html', 'js', 'css', 'image', 'font', 'video', 'other'];

/** Returns ['all', ...types in canonical order] for the given entries. */
export function uniqueTypes(entries: HarEntry[]): string[] {
  const seen = new Set<string>();
  entries.forEach((e) => seen.add(resourceType(e)));
  const ordered = TYPE_ORDER.filter((t) => seen.has(t));
  // Append any unknown types not in TYPE_ORDER at the end.
  seen.forEach((t) => {
    if (!TYPE_ORDER.includes(t)) ordered.push(t);
  });
  return ['all', ...ordered];
}

// ── Event-line label formatting ───────────────────────────────────────────────

/** Format a page-timing value as a human-readable label, e.g. "DCL 1.23s". */
export function fmtEventLabel(label: string, ms: number): string {
  return `${label} ${Math.round(ms)} ms`;
}

/** Extract DCL and Load events from HAR page timings, filtered to valid values. */
export function pageEvents(
  timings: HarPageTimings,
  totalMs: number,
): Array<{ ms: number; cls: string; label: string }> {
  const events: Array<{ ms: number; cls: string; label: string }> = [];
  if ((timings.onContentLoad ?? 0) > 0)
    events.push({
      ms: timings.onContentLoad!,
      cls: 'wf-event--dcl',
      label: 'DCL',
    });
  if ((timings.onLoad ?? 0) > 0)
    events.push({ ms: timings.onLoad!, cls: 'wf-event--load', label: 'Load' });
  if ((timings._lcp ?? 0) > 0)
    events.push({ ms: timings._lcp!, cls: 'wf-event--lcp', label: 'LCP' });
  return events.filter((ev) => ev.ms > 0 && ev.ms <= totalMs);
}
