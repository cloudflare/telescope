/**
 * Unit tests for the pure layout helpers in src/layout.ts.
 *
 * Pure-node tests — no browser, no DOM.
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from 'vitest';

import {
  PHASE_BUTTONS,
  EVENT_DEFS,
  presentEvents,
  tickPositions,
  statusClass,
  entrySize,
  rowClasses,
  activePhasesList,
  phasesDataAttr,
  rowDataAttrs,
  computeTimelineLayout,
} from '../dist/layout.js';
import type { Har, HarEntry } from '../dist/har.js';

const PKG_ROOT = path.resolve(import.meta.dirname, '..');
const DEMO_HAR: Har = JSON.parse(
  fs.readFileSync(path.resolve(PKG_ROOT, 'public', 'demo.har'), 'utf8'),
);

// ── Test fixtures ────────────────────────────────────────────────────────────

function makeEntry(overrides: Partial<HarEntry> = {}): HarEntry {
  return {
    startedDateTime: '2025-01-01T00:00:00.000Z',
    time: 100,
    request: {
      method: 'GET',
      url: 'https://example.com/x',
      httpVersion: 'h2',
      headers: [],
      cookies: [],
      queryString: [],
      headersSize: -1,
      bodySize: 0,
    },
    response: {
      status: 200,
      statusText: 'OK',
      httpVersion: 'h2',
      headers: [],
      cookies: [],
      content: { size: 0, mimeType: 'text/plain' },
      redirectURL: '',
      headersSize: -1,
      bodySize: 1234,
    },
    timings: {
      blocked: 0,
      dns: 0,
      connect: 0,
      ssl: 0,
      send: 0,
      wait: 0,
      receive: 0,
    },
    ...overrides,
  };
}

// ── Static config tables ─────────────────────────────────────────────────────

describe('PHASE_BUTTONS', () => {
  it('has the four canonical phases in order', () => {
    expect(PHASE_BUTTONS.map(([p]) => p)).toEqual([
      'blocked',
      'dns',
      'connect',
      'ssl',
    ]);
  });
});

describe('EVENT_DEFS', () => {
  it('has the three canonical events in order', () => {
    expect(EVENT_DEFS.map((e) => e.key)).toEqual([
      'ev-dcl',
      'ev-load',
      'ev-lcp',
    ]);
  });
});

describe('presentEvents', () => {
  it('returns empty when no timings are positive', () => {
    expect(presentEvents({})).toEqual([]);
    expect(presentEvents({ onLoad: 0, onContentLoad: 0, _lcp: 0 })).toEqual([]);
  });

  it('filters to only metrics with positive values, preserving order', () => {
    expect(
      presentEvents({ _lcp: 1500, onContentLoad: 100, onLoad: 800 }).map(
        (e) => e.key,
      ),
    ).toEqual(['ev-dcl', 'ev-load', 'ev-lcp']);
  });

  it('skips negative or undefined values', () => {
    expect(presentEvents({ onLoad: 800 }).map((e) => e.key)).toEqual([
      'ev-load',
    ]);
  });
});

// ── tickPositions ────────────────────────────────────────────────────────────

describe('tickPositions', () => {
  it('returns evenly spaced ms ticks below totalMs', () => {
    // total/8 = 125 → first target >= 125 is 200 → ticks at 200, 400, 600, 800
    expect(tickPositions(1000)).toEqual([200, 400, 600, 800]);
  });

  it('uses the smallest matching interval for small totals', () => {
    // total/8 ≈ 25 → first target >= 25 is 50
    expect(tickPositions(200)).toEqual([50, 100, 150]);
  });

  it('falls back to the largest target for very large totals', () => {
    // no target >= 10000/8 = 1250 except 2000+ → uses 2000
    expect(tickPositions(10000)).toEqual([2000, 4000, 6000, 8000]);
  });

  it('returns empty when totalMs is 0', () => {
    expect(tickPositions(0)).toEqual([]);
  });
});

// ── statusClass ──────────────────────────────────────────────────────────────

describe('statusClass', () => {
  it('classifies status codes at boundaries', () => {
    expect(statusClass(199)).toBe('s2xx'); // anything < 300 is 2xx in this scheme
    expect(statusClass(200)).toBe('s2xx');
    expect(statusClass(299)).toBe('s2xx');
    expect(statusClass(300)).toBe('s3xx');
    expect(statusClass(399)).toBe('s3xx');
    expect(statusClass(400)).toBe('s4xx');
    expect(statusClass(499)).toBe('s4xx');
    expect(statusClass(500)).toBe('s5xx');
    expect(statusClass(599)).toBe('s5xx');
  });
});

// ── entrySize ────────────────────────────────────────────────────────────────

describe('entrySize', () => {
  it('prefers _transferSize when present', () => {
    const e = makeEntry();
    e.response._transferSize = 5678;
    expect(entrySize(e)).toBe(5678);
  });

  it('falls back to bodySize when _transferSize is absent', () => {
    expect(entrySize(makeEntry())).toBe(1234);
  });
});

// ── rowClasses ───────────────────────────────────────────────────────────────

describe('rowClasses', () => {
  it('builds the base class string with row height suffix', () => {
    const e = makeEntry();
    expect(rowClasses(e, 16)).toBe('wf-row wf-row--rh26');
  });

  it('appends row--blocking when blocked > 100', () => {
    const e = makeEntry({
      timings: {
        blocked: 150,
        dns: 0,
        connect: 0,
        ssl: 0,
        send: 0,
        wait: 0,
        receive: 0,
      },
    });
    expect(rowClasses(e, 16)).toBe('wf-row wf-row--rh26 row--blocking');
  });

  it('appends extra classes after blocking', () => {
    const e = makeEntry();
    expect(rowClasses(e, 16, ['row--open'])).toBe(
      'wf-row wf-row--rh26 row--open',
    );
  });

  it('filters out empty extras', () => {
    const e = makeEntry();
    expect(rowClasses(e, 16, ['', 'row--open', ''])).toBe(
      'wf-row wf-row--rh26 row--open',
    );
  });
});

// ── activePhasesList / phasesDataAttr ────────────────────────────────────────

describe('activePhasesList', () => {
  it('returns empty for an entry with no positive phases', () => {
    expect(activePhasesList(makeEntry())).toEqual([]);
  });

  it('includes phases with positive values in canonical order', () => {
    const e = makeEntry({
      timings: {
        blocked: 0,
        dns: 5,
        connect: 0,
        ssl: 10,
        send: 0,
        wait: 0,
        receive: 0,
      },
    });
    expect(activePhasesList(e)).toEqual(['dns', 'ssl']);
  });

  it('combines blocked + _blocked_queueing', () => {
    const e = makeEntry({
      timings: {
        blocked: 0,
        _blocked_queueing: 7,
        dns: 0,
        connect: 0,
        ssl: 0,
        send: 0,
        wait: 0,
        receive: 0,
      },
    });
    expect(activePhasesList(e)).toEqual(['blocked']);
  });

  it('treats negative values as zero', () => {
    const e = makeEntry({
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        ssl: -1,
        send: 0,
        wait: 0,
        receive: 0,
      },
    });
    expect(activePhasesList(e)).toEqual([]);
  });
});

describe('phasesDataAttr', () => {
  it('joins active phases with a single space', () => {
    const e = makeEntry({
      timings: {
        blocked: 50,
        dns: 5,
        connect: 0,
        ssl: 10,
        send: 0,
        wait: 0,
        receive: 0,
      },
    });
    expect(phasesDataAttr(e)).toBe('blocked dns ssl');
  });

  it('is empty when no phases are active', () => {
    expect(phasesDataAttr(makeEntry())).toBe('');
  });
});

// ── rowDataAttrs ─────────────────────────────────────────────────────────────

describe('rowDataAttrs', () => {
  it('includes all timing fields as strings', () => {
    const e = makeEntry({
      time: 250,
      timings: {
        blocked: 1,
        dns: 2,
        connect: 3,
        ssl: 4,
        send: 5,
        wait: 6,
        receive: 7,
      },
    });
    const attrs = rowDataAttrs(e);
    expect(attrs).toEqual({
      started: '2025-01-01T00:00:00.000Z',
      time: '250',
      blocked: '1',
      dns: '2',
      connect: '3',
      ssl: '4',
      send: '5',
      wait: '6',
      receive: '7',
      'body-size': '1234',
    });
  });

  it('omits transfer-size when _transferSize is undefined', () => {
    const attrs = rowDataAttrs(makeEntry());
    expect('transfer-size' in attrs).toBe(false);
  });

  it('includes transfer-size when _transferSize is set', () => {
    const e = makeEntry();
    e.response._transferSize = 9999;
    expect(rowDataAttrs(e)['transfer-size']).toBe('9999');
  });

  it('clamps negative timings to 0', () => {
    const e = makeEntry({
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        ssl: -1,
        send: -1,
        wait: -1,
        receive: -1,
      },
    });
    const attrs = rowDataAttrs(e);
    expect(attrs.blocked).toBe('0');
    expect(attrs.dns).toBe('0');
    expect(attrs.connect).toBe('0');
    expect(attrs.ssl).toBe('0');
    expect(attrs.send).toBe('0');
    expect(attrs.wait).toBe('0');
    expect(attrs.receive).toBe('0');
  });
});

// ── computeTimelineLayout ────────────────────────────────────────────────────

describe('computeTimelineLayout', () => {
  it('returns no segments when all timings are zero (still emits durLabel/barEndPct)', () => {
    const e = makeEntry({ time: 100 });
    const layout = computeTimelineLayout(e, 1000, +new Date(e.startedDateTime));
    expect(layout.segments).toEqual([]);
    expect(layout.barEndPct).toBeCloseTo(10, 10);
    expect(layout.durLabel).toBe('100 ms');
  });

  it('short-circuits to a sane empty layout when totalMs <= 0', () => {
    const e = makeEntry({
      time: 50,
      timings: {
        blocked: 10,
        dns: 5,
        connect: 5,
        ssl: 0,
        send: 10,
        wait: 10,
        receive: 10,
      },
    });
    for (const totalMs of [0, -1, -1000]) {
      const layout = computeTimelineLayout(
        e,
        totalMs,
        +new Date(e.startedDateTime),
      );
      expect(layout.segments).toEqual([]);
      expect(layout.barEndPct).toBe(0);
      expect(Number.isFinite(layout.barEndPct)).toBe(true);
      expect(layout.durLabel).toBe('50 ms');
    }
  });

  it('places phase segments left-to-right at correct percentages', () => {
    const e = makeEntry({
      time: 100,
      timings: {
        blocked: 10,
        dns: 20,
        connect: 30,
        ssl: 40,
        send: 0,
        wait: 0,
        receive: 0,
      },
    });
    const layout = computeTimelineLayout(e, 1000, +new Date(e.startedDateTime));
    // offset = 0, total = 1000
    // blocked at left=0, width=1% (10/1000)
    // dns at left=1, width=2
    // connect at left=3, width=3
    // ssl at left=6, width=4
    expect(layout.segments.map((s) => s.cls)).toEqual([
      'wb--blocked wb--phase',
      'wb--dns wb--phase',
      'wb--connect wb--phase',
      'wb--ssl wb--phase',
    ]);
    expect(layout.segments[0]!.leftPct).toBeCloseTo(0, 10);
    expect(layout.segments[0]!.widthPct).toBeCloseTo(1, 10);
    expect(layout.segments[1]!.leftPct).toBeCloseTo(1, 10);
    expect(layout.segments[1]!.widthPct).toBeCloseTo(2, 10);
    expect(layout.segments[2]!.leftPct).toBeCloseTo(3, 10);
    expect(layout.segments[3]!.leftPct).toBeCloseTo(6, 10);
  });

  it('emits resource-type light/dark bars for send+wait and receive', () => {
    const e = makeEntry({
      time: 100,
      _resourceType: 'script',
      timings: {
        blocked: 0,
        dns: 0,
        connect: 0,
        ssl: 0,
        send: 5,
        wait: 15, // send+wait = 20
        receive: 10,
      },
    });
    const layout = computeTimelineLayout(e, 1000, +new Date(e.startedDateTime));
    expect(layout.segments.map((s) => s.cls)).toEqual([
      'wb--js-light',
      'wb--js-dark',
    ]);
    expect(layout.segments[0]!.widthPct).toBeCloseTo(2, 10); // 20/1000
    expect(layout.segments[1]!.widthPct).toBeCloseTo(1, 10); // 10/1000
    expect(layout.segments[0]!.tooltip).toBe('Send+Wait: 20 ms');
    expect(layout.segments[1]!.tooltip).toBe('Receive: 10 ms');
  });

  it('respects an originMs offset on startedDateTime', () => {
    const start = new Date('2025-01-01T00:00:00.500Z').toISOString();
    const e = makeEntry({
      startedDateTime: start,
      time: 100,
      timings: {
        blocked: 50,
        dns: 0,
        connect: 0,
        ssl: 0,
        send: 0,
        wait: 0,
        receive: 0,
      },
    });
    const origin = +new Date('2025-01-01T00:00:00.000Z');
    const layout = computeTimelineLayout(e, 1000, origin);
    // offsetPct = (500 / 1000) * 100 = 50
    expect(layout.segments[0]!.leftPct).toBeCloseTo(50, 10);
    expect(layout.barEndPct).toBeCloseTo(60, 10); // 50 + 100/1000*100
  });

  it('treats negative timing values as zero (no negative-width segments)', () => {
    const e = makeEntry({
      time: 100,
      timings: {
        blocked: -1,
        dns: -1,
        connect: -1,
        ssl: -1,
        send: -1,
        wait: -1,
        receive: -1,
      },
    });
    const layout = computeTimelineLayout(e, 1000, +new Date(e.startedDateTime));
    expect(layout.segments).toEqual([]);
  });

  it('combines _blocked_queueing into the blocked phase', () => {
    const e = makeEntry({
      time: 100,
      timings: {
        blocked: 30,
        _blocked_queueing: 20,
        dns: 0,
        connect: 0,
        ssl: 0,
        send: 0,
        wait: 0,
        receive: 0,
      },
    });
    const layout = computeTimelineLayout(e, 1000, +new Date(e.startedDateTime));
    expect(layout.segments).toHaveLength(1);
    expect(layout.segments[0]!.cls).toBe('wb--blocked wb--phase');
    expect(layout.segments[0]!.widthPct).toBeCloseTo(5, 10); // 50/1000
    expect(layout.segments[0]!.tooltip).toBe('Blocked: 50 ms');
  });
});

// ── Smoke test against demo HAR ──────────────────────────────────────────────

describe('computeTimelineLayout against demo.har', () => {
  it('produces non-empty segments for every entry', () => {
    const entries = DEMO_HAR.log.entries;
    expect(entries.length).toBeGreaterThan(0);
    const origin = +new Date(entries[0]!.startedDateTime);
    const total = 5000; // any positive value; just to exercise the function
    for (const entry of entries) {
      const layout = computeTimelineLayout(entry, total, origin);
      expect(layout.barEndPct).toBeGreaterThanOrEqual(0);
      expect(typeof layout.durLabel).toBe('string');
      expect(Array.isArray(layout.segments)).toBe(true);
    }
  });
});
