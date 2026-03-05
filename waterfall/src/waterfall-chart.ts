/**
 * <waterfall-chart> — HAR waterfall chart custom element.
 *
 * Renders into the **light DOM** (no Shadow Root) so that the companion
 * `waterfall.css` stylesheet — linked in <head> — applies immediately and
 * paints before this JS module is parsed.
 *
 * Usage
 * ─────
 *   <!-- stylesheet must come before the script -->
 *   <link rel="stylesheet" href="/waterfall/waterfall.css" />
 *   <script type="module" src="/waterfall/dist/index.js"></script>
 *
 *   <!-- pre-rendered static HTML children (from renderToHTML()) -->
 *   <waterfall-chart>
 *     <!-- ...output of renderToHTML(har)... -->
 *   </waterfall-chart>
 *
 *   <!-- fetch HAR from a URL -->
 *   <waterfall-chart src="/api/tests/abc123/pageload.har"></waterfall-chart>
 *
 *   <!-- or supply HAR data programmatically -->
 *   <waterfall-chart id="wf"></waterfall-chart>
 *   <script>document.getElementById('wf').har = harObject;</script>
 *
 * Data source priority (highest → lowest):
 *   1. `.har` JS property
 *   2. `src` attribute (fetch)
 *   3. Pre-rendered static HTML children (from renderToHTML())
 *
 * When pre-rendered children are detected, the component wires up
 * interactivity (filters, row click → detail panel, column toggle,
 * event-line pixel positioning) without re-rendering.
 *
 * Attributes
 * ──────────
 *   src   URL from which to fetch HAR JSON.  Changing the attribute
 *         causes the component to re-fetch and re-render.
 *
 * Properties
 * ──────────
 *   har   Set a Har object directly (overrides src).
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
// Lightweight typed DOM helper
// ─────────────────────────────────────────────────────────────────────────────

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<Record<string, string>> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (v === undefined) continue;
    if (k === 'className') node.className = v;
    else node.setAttribute(k, v);
  }
  if (text !== undefined) node.textContent = text;
  return node;
}

// ─────────────────────────────────────────────────────────────────────────────
// Custom element
// ─────────────────────────────────────────────────────────────────────────────

export class WaterfallChart extends HTMLElement {
  static observedAttributes = ['src'];

  // ── Light-DOM refs (populated by _buildDOM or _adoptDOM) ──────────────────
  private _filtersEl!: HTMLElement;
  private _listWrapEl!: HTMLElement;
  private _colHeadersEl!: HTMLElement;
  private _listEl!: HTMLOListElement;
  private _rulerEl!: HTMLElement;
  private _overlayEl!: HTMLElement;
  private _loadingEl!: HTMLElement;
  private _errorEl!: HTMLElement;
  private _toggleBtn!: HTMLButtonElement;

  // ── Component state ───────────────────────────────────────────────────────
  private _allEntries: HarEntry[] = [];
  private _activeFilters = new Set<string>(['all']);
  private _openPanels = new Map<number, HTMLElement>();
  private _pageTimings: HarPageTimings = {};
  private _totalMs = 0;
  private _originMs = 0;

  // ── Programmatic HAR property ─────────────────────────────────────────────
  private _harData: Har | null = null;

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  connectedCallback() {
    if (this._harData) {
      // Programmatic .har property was set before connection
      this._buildDOM();
      this._loadHarData(this._harData);
    } else if (this.hasAttribute('src')) {
      this._buildDOM();
      this._fetchAndRender(this.getAttribute('src')!);
    } else if (this.querySelector('.wf-list')) {
      // Pre-rendered static HTML children detected — adopt and wire up
      this._adoptDOM();
    }
    // else: empty element, nothing to do until src/har are set
  }

  attributeChangedCallback(
    name: string,
    old: string | null,
    next: string | null,
  ) {
    // Ignore the initial attribute parse (old === null) — connectedCallback
    // handles the first render. Only react to genuine changes after connection.
    if (name === 'src' && old !== null && next !== null && this.isConnected) {
      this._teardownAndBuild();
      this._fetchAndRender(next);
    }
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /** Set a HAR object directly — bypasses the src attribute fetch. */
  set har(data: Har) {
    this._harData = data;
    if (this.isConnected) {
      this._teardownAndBuild();
      this._loadHarData(data);
    }
  }

  get har(): Har | null {
    return this._harData;
  }

  // ── Teardown helpers ──────────────────────────────────────────────────────

  /**
   * Clear all existing content (pre-rendered or previously JS-rendered) and
   * call _buildDOM() to lay down a fresh skeleton ready for _loadHarData().
   */
  private _teardownAndBuild() {
    this.innerHTML = '';
    this._openPanels.clear();
    this._activeFilters = new Set(['all']);
    this._allEntries = [];
    this._pageTimings = {};
    this._totalMs = 0;
    this._originMs = 0;
    this._buildDOM();
  }

  // ── Adopt pre-rendered DOM ────────────────────────────────────────────────

  /**
   * Called when pre-rendered static HTML children (from renderToHTML()) are
   * present. Grabs refs to the existing nodes, reconstructs component state
   * by reading data-* attributes from <li> rows, then wires up all
   * interactivity without touching the existing DOM structure.
   */
  private _adoptDOM() {
    // Grab refs to existing nodes
    this._listWrapEl = this.querySelector('.wf-list-wrap') as HTMLElement;
    this._colHeadersEl = this.querySelector('.wf-col-headers') as HTMLElement;
    this._listEl = this.querySelector('.wf-list') as HTMLOListElement;
    this._rulerEl = this.querySelector('.wf-ruler') as HTMLElement;
    this._overlayEl = this.querySelector('.wf-events-overlay') as HTMLElement;
    this._filtersEl = this.querySelector('.wf-filters') as HTMLElement;
    this._toggleBtn = this.querySelector(
      '.wf-toggle-cols',
    ) as HTMLButtonElement;
    this._loadingEl = this.querySelector('.wf-loading') as HTMLElement;
    this._errorEl = this.querySelector('.wf-error') as HTMLElement;

    // Hide the loading message (pre-rendered content is already visible)
    if (this._loadingEl) this._loadingEl.hidden = true;

    // Reconstruct _allEntries from data-* on the <li> rows.
    // We read enough to support filtering, panel rendering, and event lines.
    const rows = Array.from(
      this._listEl.querySelectorAll<HTMLElement>('li[data-index]'),
    );
    this._allEntries = rows.map((li) => this._entryFromRow(li));

    if (!this._allEntries.length) return;

    this._totalMs = computeTotalMs(this._allEntries);
    this._originMs = +new Date(this._allEntries[0]!.startedDateTime);
    this._pageTimings = this._readPageTimings();

    // Wire up toggle button
    this._toggleBtn.addEventListener('click', () => this._onToggleCols());

    // Wire up filter chips — they already have the right labels from SSR
    const chipBtns = Array.from(
      this._filtersEl.querySelectorAll<HTMLButtonElement>('.wf-filter-btn'),
    );
    const types = chipBtns.map((b) => b.textContent?.trim() ?? '');
    chipBtns.forEach((btn) => {
      const type = btn.textContent?.trim() ?? '';
      btn.addEventListener('click', () => {
        if (type === 'all') {
          this._activeFilters = new Set(['all']);
        } else {
          this._activeFilters.delete('all');
          this._activeFilters.has(type)
            ? this._activeFilters.delete(type)
            : this._activeFilters.add(type);
          if (!this._activeFilters.size) this._activeFilters = new Set(['all']);
        }
        this._syncFilterChips(types);
        this._renderRows();
      });
    });

    // Wire up row click → detail panel
    rows.forEach((li, i) => {
      li.addEventListener('click', () =>
        this._togglePanel(i, this._allEntries[i]!),
      );
    });

    // Re-position event lines with accurate pixel measurements
    const ro = new ResizeObserver(() => {
      if (this._rulerEl.offsetWidth > 0) {
        ro.disconnect();
        this._renderEventLines();
      }
    });
    ro.observe(this._rulerEl);
  }

  /**
   * Reconstruct a minimal HarEntry from the data-* attributes and visible
   * text content of a pre-rendered <li> row.
   *
   * The static renderer embeds everything needed: timings as inline bar
   * widths/positions are re-derived from the entry data, so we read the
   * source values from the li's dataset.
   */
  private _entryFromRow(li: HTMLElement): HarEntry {
    const d = li.dataset;
    const url = li.querySelector('.wf-cell--url')?.getAttribute('title') ?? '';
    const method =
      li.querySelector('.wf-cell--info')?.textContent?.trim() ?? 'GET';
    const cells = li.querySelectorAll('.wf-cell--info');
    const protocol = cells[1]?.textContent?.trim() ?? 'h2';
    const statusText = cells[2]?.textContent?.trim() ?? '200';
    const type = cells[3]?.textContent?.trim() ?? 'other';

    // Timings are stored in data-* by the gen-demo script
    const n = (k: string) => parseFloat(d[k] ?? '0') || 0;
    const blocked = n('blocked');
    const dns = n('dns');
    const connect = n('connect');
    const ssl = n('ssl');
    const send = n('send');
    const wait = n('wait');
    const receive = n('receive');
    const time = n('time');
    const bodySize = n('bodySize');
    const transferSize = n('transferSize');
    const startedDateTime = d['started'] ?? new Date().toISOString();
    const status = parseInt(statusText, 10) || 200;

    return {
      startedDateTime,
      time,
      _resourceType: type,
      request: {
        method,
        url,
        httpVersion: protocol,
        headers: [],
        cookies: [],
        queryString: [],
        headersSize: -1,
        bodySize: 0,
      },
      response: {
        status,
        statusText: status === 200 ? 'OK' : String(status),
        httpVersion: protocol,
        headers: [],
        cookies: [],
        content: { size: bodySize, mimeType: '' },
        redirectURL: '',
        headersSize: -1,
        bodySize,
        _transferSize: transferSize || undefined,
      },
      timings: { blocked, dns, connect, ssl, send, wait, receive },
    };
  }

  /**
   * Read page timings from the overlay's event-line data-label attributes.
   * The static renderer encodes the ms value in the formatted label
   * (e.g. "DCL 340ms" or "Load 1.23s"). We parse it back out.
   */
  private _readPageTimings(): HarPageTimings {
    const timings: HarPageTimings = {};
    this._overlayEl
      ?.querySelectorAll<HTMLElement>('.wf-event-line')
      .forEach((line) => {
        const label = line.dataset.label ?? '';
        const ms = this._parseLabelMs(label);
        if (line.classList.contains('wf-event--dcl'))
          timings.onContentLoad = ms;
        else if (line.classList.contains('wf-event--load')) timings.onLoad = ms;
      });
    return timings;
  }

  /** Parse ms back out of a formatted label like "DCL 340ms" or "Load 1.23s". */
  private _parseLabelMs(label: string): number {
    const secMatch = label.match(/([\d.]+)s$/);
    if (secMatch) return parseFloat(secMatch[1]!) * 1000;
    const msMatch = label.match(/(\d+)ms$/);
    if (msMatch) return parseInt(msMatch[1]!, 10);
    return 0;
  }

  // ── Initial DOM construction (dynamic path) ───────────────────────────────

  private _buildDOM() {
    // ── Legend ──────────────────────────────────────────────────────────────
    const legend = el('div', {
      className: 'wf-legend',
      'aria-label': 'Waterfall chart legend',
    });

    const mkSwatch = (thin: boolean, key: string) => {
      const s = el('span', {
        className: `wf-swatch wf-swatch--${thin ? 'thin' : 'thick'} wf-swatch--${key}`,
      });
      return s;
    };
    const mkItem = (thin: boolean, key: string, label: string) => {
      const span = el('span', { className: 'wf-legend-item' });
      span.appendChild(mkSwatch(thin, key));
      span.appendChild(document.createTextNode(label));
      return span;
    };

    const row1 = el('div', { className: 'wf-legend-row' });
    const heading1 = el(
      'span',
      { className: 'wf-legend-heading' },
      'Connection phases',
    );
    row1.append(
      heading1,
      mkItem(true, 'blocked', 'Blocked'),
      mkItem(true, 'dns', 'DNS'),
      mkItem(true, 'connect', 'Connect'),
      mkItem(true, 'ssl', 'SSL'),
      mkItem(true, 'send', 'Send'),
      mkItem(true, 'wait', 'Wait'),
    );

    const row2 = el('div', { className: 'wf-legend-row' });
    const heading2 = el('span', { className: 'wf-legend-heading' });
    heading2.append(
      document.createTextNode('File type '),
      Object.assign(el('span', { className: 'wf-legend-note' }), {
        textContent:
          '(light\u00a0=\u00a0sent \u00b7 dark\u00a0=\u00a0received)',
      }),
    );
    row2.append(
      heading2,
      mkItem(false, 'html', 'HTML'),
      mkItem(false, 'js', 'JS'),
      mkItem(false, 'css', 'CSS'),
      mkItem(false, 'image', 'Image'),
      mkItem(false, 'font', 'Font'),
      mkItem(false, 'video', 'Video'),
      mkItem(false, 'other', 'Other'),
    );

    const row3 = el('div', { className: 'wf-legend-row' });
    row3.append(
      el('span', { className: 'wf-legend-heading' }, 'Events'),
      mkItem(true, 'ev-dcl', 'DCL'),
      mkItem(true, 'ev-load', 'Load'),
    );

    legend.append(row1, row2, row3);

    // ��─ Toolbar ──────────────────────────────────────────────────────────────
    this._filtersEl = el('div', {
      className: 'wf-filters',
      role: 'group',
      'aria-label': 'Filter by resource type',
    });
    this._toggleBtn = el(
      'button',
      { className: 'wf-toggle-cols', 'aria-expanded': 'false' },
      'Show columns',
    );
    this._toggleBtn.addEventListener('click', () => this._onToggleCols());

    const toolbar = el('div', { className: 'wf-toolbar' });
    toolbar.append(this._filtersEl, this._toggleBtn);

    // ── List wrapper ──────────────────────────────────────────────────────────
    this._overlayEl = el('div', {
      className: 'wf-events-overlay',
      'aria-hidden': 'true',
    });

    // Column header row
    this._rulerEl = el('div', { className: 'wf-ruler', 'aria-hidden': 'true' });
    const timelineHeader = el('div', {
      className: 'wf-col-header wf-col-header--timeline',
    });
    timelineHeader.appendChild(this._rulerEl);

    this._colHeadersEl = el('div', {
      className: 'wf-col-headers',
      'aria-hidden': 'true',
    });
    this._colHeadersEl.append(
      el('div', { className: 'wf-col-header wf-col-header--idx' }, '#'),
      el('div', { className: 'wf-col-header wf-col-header--url' }, 'URL'),
      el('div', { className: 'wf-col-header wf-col-header--info' }, 'Method'),
      el('div', { className: 'wf-col-header wf-col-header--info' }, 'Protocol'),
      el('div', { className: 'wf-col-header wf-col-header--info' }, 'Status'),
      el('div', { className: 'wf-col-header wf-col-header--info' }, 'Type'),
      el(
        'div',
        { className: 'wf-col-header wf-col-header--info wf-col-header--size' },
        'Size',
      ),
      el(
        'div',
        { className: 'wf-col-header wf-col-header--info wf-col-header--dur' },
        'Duration',
      ),
      timelineHeader,
    );

    // Request list
    this._listEl = el('ol', { className: 'wf-list' });
    this._listEl.setAttribute('aria-label', 'Network requests');

    this._listWrapEl = el('div', { className: 'wf-list-wrap' });
    this._listWrapEl.append(this._overlayEl, this._colHeadersEl, this._listEl);

    // ── State messages ────────────────────────────────────────────────────────
    this._loadingEl = el(
      'p',
      { className: 'wf-message wf-loading', 'aria-live': 'polite' },
      'Loading waterfall\u2026',
    );
    this._errorEl = el('p', {
      className: 'wf-message wf-message--error wf-error',
    });
    this._errorEl.hidden = true;

    // ── Append everything to the element itself (light DOM) ───────────────────
    this.append(
      legend,
      toolbar,
      this._listWrapEl,
      this._loadingEl,
      this._errorEl,
    );
  }

  // ── Column toggle ─────────────────────────────────────────────────────────

  private _onToggleCols() {
    const expanded = this._toggleBtn.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      this._listWrapEl.classList.remove('cols-expanded');
      this._toggleBtn.setAttribute('aria-expanded', 'false');
      this._toggleBtn.textContent = 'Show columns';
    } else {
      this._listWrapEl.classList.add('cols-expanded');
      this._toggleBtn.setAttribute('aria-expanded', 'true');
      this._toggleBtn.textContent = 'Hide columns';
    }
    this._renderEventLines();
  }

  // ── Data loading ──────────────────────────────────────────────────────────

  private async _fetchAndRender(src: string) {
    this._showLoading(true);
    try {
      const res = await fetch(src);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const har: Har = await res.json();
      this._loadHarData(har);
    } catch (err) {
      this._showError(`Failed to load waterfall: ${(err as Error).message}`);
    }
  }

  private _loadHarData(har: Har) {
    try {
      const entries = har.log.entries ?? [];
      if (!entries.length) throw new Error('No entries in HAR file');
      this._allEntries = entries;
      this._pageTimings = har.log.pages?.[0]?.pageTimings ?? {};
      this._totalMs = computeTotalMs(entries);
      this._originMs = +new Date(entries[0]!.startedDateTime);
      this._showLoading(false);
      this._renderFilters(uniqueTypes(entries));
      this._renderRuler();
      this._renderRows();
      // Defer event lines until layout has settled
      const ro = new ResizeObserver(() => {
        if (this._rulerEl.offsetWidth > 0) {
          ro.disconnect();
          this._renderEventLines();
        }
      });
      ro.observe(this._rulerEl);
    } catch (err) {
      this._showError(`Failed to render waterfall: ${(err as Error).message}`);
    }
  }

  // ── Reset ─────────────────────────────────────────────────────────────────

  private _reset() {
    this._allEntries = [];
    this._activeFilters = new Set(['all']);
    this._openPanels.clear();
    this._pageTimings = {};
    this._totalMs = 0;
    this._originMs = 0;
    this._listEl.innerHTML = '';
    this._filtersEl.innerHTML = '';
    this._rulerEl.innerHTML = '';
    this._overlayEl.innerHTML = '';
    this._errorEl.hidden = true;
    this._errorEl.textContent = '';
    // Remove any open detail panels
    this.querySelectorAll('.wf-panel').forEach((p) => p.remove());
    this._showLoading(true);
  }

  // ── UI state helpers ──────────────────────────────────────────────────────

  private _showLoading(visible: boolean) {
    this._loadingEl.hidden = !visible;
  }

  private _showError(msg: string) {
    this._showLoading(false);
    this._errorEl.hidden = false;
    this._errorEl.textContent = msg;
  }

  // ── Filter chips ──────────────────────────────────────────────────────────

  private _renderFilters(types: string[]) {
    this._filtersEl.innerHTML = '';
    for (const type of types) {
      const active = this._activeFilters.has(type);
      const btn = el(
        'button',
        { className: `wf-filter-btn${active ? ' active' : ''}` },
        type,
      );
      btn.addEventListener('click', () => {
        if (type === 'all') {
          this._activeFilters = new Set(['all']);
        } else {
          this._activeFilters.delete('all');
          this._activeFilters.has(type)
            ? this._activeFilters.delete(type)
            : this._activeFilters.add(type);
          if (!this._activeFilters.size) this._activeFilters = new Set(['all']);
        }
        this._renderFilters(types);
        this._renderRows();
      });
      this._filtersEl.appendChild(btn);
    }
  }

  /** Sync active/inactive CSS classes on pre-existing filter chip buttons. */
  private _syncFilterChips(types: string[]) {
    const btns = Array.from(
      this._filtersEl.querySelectorAll<HTMLButtonElement>('.wf-filter-btn'),
    );
    btns.forEach((btn, i) => {
      const type = types[i] ?? '';
      btn.classList.toggle('active', this._activeFilters.has(type));
    });
  }

  // ── Timeline cell ─────────────────────────────────────────────────────────

  private _makeTimelineCell(entry: HarEntry): HTMLElement {
    const cell = el('span', { className: 'wf-cell wf-cell--timeline' });
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
      this._totalMs > 0
        ? ((+new Date(entry.startedDateTime) - this._originMs) /
            this._totalMs) *
          100
        : 0;

    const wrap = el('div', { className: 'wf-bar-wrap' });
    // No inline height — .wf-bar-wrap picks up --wf-bar-wrap-h from the row class.

    // Only left and width are set via inline style — heights come from CSS classes.
    const addBar = (
      cls: string,
      leftPct: number,
      widthPct: number,
      tooltip: string,
    ) => {
      if (widthPct <= 0) return;
      const b = el('div', { className: `wb ${cls}`, title: tooltip });
      b.style.left = `${leftPct}%`;
      b.style.width = `${Math.max(widthPct, 0.1)}%`;
      wrap.appendChild(b);
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
      const pct = (val / this._totalMs) * 100;
      addBar(cls, cursor, pct, `${label}: ${fmtMs(val)}`);
      cursor += pct;
    }

    const resCursor =
      offsetPct + ((blocked + dns + connect + ssl) / this._totalMs) * 100;
    const sentPct = ((send + wait) / this._totalMs) * 100;
    const recvPct = (receive / this._totalMs) * 100;
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

    cell.appendChild(wrap);
    return cell;
  }

  // ── Detail panel ──────────────────────────────────────────────────────────

  private _togglePanel(index: number, entry: HarEntry) {
    if (this._openPanels.has(index)) {
      this._openPanels.get(index)!.remove();
      this._openPanels.delete(index);
      this.querySelectorAll(`.wf-row[data-index="${index}"]`).forEach((r) =>
        r.classList.remove('row--open'),
      );
      return;
    }

    const t = entry.timings;
    const size = entry.response._transferSize ?? entry.response.bodySize;

    const panel = el('div', { className: 'wf-panel' });
    panel.dataset.panelIndex = String(index);

    // Header
    const titleEl = el('span', { className: 'wf-panel-title' });
    titleEl.textContent = `#${index + 1} \u2014 ${entry.request.url}`;
    titleEl.title = entry.request.url;
    const closeBtn = el(
      'button',
      { className: 'wf-panel-close', title: 'Close' },
      '\u00d7',
    );
    closeBtn.addEventListener('click', () => this._togglePanel(index, entry));
    const hdr = el('div', { className: 'wf-panel-header' });
    hdr.append(titleEl, closeBtn);
    panel.appendChild(hdr);

    const body = el('div', { className: 'wf-panel-body' });

    const section = (title: string, content: HTMLElement): HTMLElement => {
      const s = el('div', { className: 'wf-panel-section' });
      s.appendChild(el('div', { className: 'wf-section-title' }, title));
      s.appendChild(content);
      return s;
    };

    // General
    const generalWrap = el('div');
    const infoRows: Array<[string, string]> = [
      ['URL', entry.request.url],
      ['Method', entry.request.method],
      ['Protocol', entry.request.httpVersion],
      ['Status', `${entry.response.status} ${entry.response.statusText}`],
      ['Type', resourceType(entry)],
      ['Size', fmtSize(size)],
      ['IP', entry.serverIPAddress ?? '-'],
    ];
    for (const [k, v] of infoRows) {
      const row = el('div', { className: 'wf-info-row' });
      row.appendChild(el('span', { className: 'wf-info-key' }, k));
      row.appendChild(el('span', { className: 'wf-info-val' }, v));
      generalWrap.appendChild(row);
    }
    body.appendChild(section('General', generalWrap));

    // Timings
    const blocked = Math.max(0, (t.blocked ?? 0) + (t._blocked_queueing ?? 0));
    const timingRows: Array<[string, string, number]> = [
      ['wb--blocked', 'Blocked/Queued', blocked],
      ['wb--dns', 'DNS Lookup', Math.max(0, t.dns)],
      ['wb--connect', 'TCP Connect', Math.max(0, t.connect)],
      ['wb--ssl', 'SSL Handshake', Math.max(0, t.ssl ?? 0)],
      ['wb--send', 'Send', Math.max(0, t.send)],
      ['wb--wait', 'Wait (TTFB)', Math.max(0, t.wait)],
      ['wb--wait', 'Receive', Math.max(0, t.receive)],
    ];
    const timingWrap = el('div');
    for (const [cls, label, val] of timingRows) {
      if (val <= 0) continue;
      const row = el('div', { className: 'wf-timing-row' });
      const lbl = el('span', { className: 'wf-timing-label' });
      lbl.appendChild(el('span', { className: `wf-timing-swatch ${cls}` }));
      lbl.appendChild(document.createTextNode(label));
      row.appendChild(lbl);
      row.appendChild(el('span', { className: 'wf-timing-val' }, fmtMs(val)));
      timingWrap.appendChild(row);
    }
    const totalRow = el('div', { className: 'wf-timing-row wf-timing-total' });
    totalRow.appendChild(el('span', { className: 'wf-timing-label' }, 'Total'));
    totalRow.appendChild(
      el('span', { className: 'wf-timing-val' }, fmtMs(entry.time)),
    );
    timingWrap.appendChild(totalRow);
    body.appendChild(section('Timings', timingWrap));

    // Headers (may be empty for entries reconstructed from static HTML)
    const headersSection = (
      title: string,
      headers: HarEntry['request']['headers'],
    ): HTMLElement => {
      const tbl = el('table', { className: 'wf-headers-table' });
      if (!headers.length) {
        const tr = el('tr');
        tr.appendChild(
          el('td', { className: 'wf-info-val' }, '(not available)'),
        );
        tbl.appendChild(tr);
      } else {
        for (const h of headers) {
          const tr = el('tr');
          tr.appendChild(el('td', {}, h.name));
          tr.appendChild(el('td', {}, h.value));
          tbl.appendChild(tr);
        }
      }
      return section(title, tbl);
    };
    body.appendChild(headersSection('Request Headers', entry.request.headers));
    body.appendChild(
      headersSection('Response Headers', entry.response.headers),
    );
    panel.appendChild(body);

    // Insert immediately after the list wrapper
    this._listWrapEl.after(panel);
    this._openPanels.set(index, panel);
    this.querySelectorAll(`.wf-row[data-index="${index}"]`).forEach((r) =>
      r.classList.add('row--open'),
    );
  }

  // ── Ruler ─────────────────────────────────────────────────────────────────

  private _renderRuler() {
    this._rulerEl.innerHTML = '';
    const targets = [50, 100, 200, 250, 500, 1000, 2000, 5000] as const;
    const interval: number = (targets.find((t) => t >= this._totalMs / 8) ??
      targets[targets.length - 1])!;
    for (let ms = interval; ms < this._totalMs; ms += interval) {
      const tick = el('span', { className: 'wf-tick' });
      tick.style.left = `${(ms / this._totalMs) * 100}%`;
      tick.textContent =
        ms >= 1000
          ? `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 1)}s`
          : `${ms}ms`;
      this._rulerEl.appendChild(tick);
    }
  }

  // ── Event lines ───────────────────────────────────────────────────────────

  private _renderEventLines() {
    this._overlayEl.innerHTML = '';
    // Measure the timeline column header to get its pixel position
    const timelineHeader = this._colHeadersEl.querySelector(
      '.wf-col-header--timeline',
    ) as HTMLElement | null;
    if (!timelineHeader) return;
    const pad = parseFloat(getComputedStyle(timelineHeader).paddingLeft) || 8;
    const innerLeft = timelineHeader.offsetLeft + pad;
    const innerWidth = timelineHeader.offsetWidth - pad * 2;
    if (innerWidth <= 0) return;
    for (const { ms, cls, label } of pageEvents(
      this._pageTimings,
      this._totalMs,
    )) {
      const line = el('div', { className: `wf-event-line ${cls}` });
      line.dataset.label = fmtEventLabel(label, ms);
      line.style.left = `${innerLeft + (ms / this._totalMs) * innerWidth}px`;
      this._overlayEl.appendChild(line);
    }
  }

  // ── Render rows (<li> items) ──────────────────────────────────────────────

  private _renderRows() {
    this._listEl.innerHTML = '';
    let visIdx = 0;
    this._allEntries.forEach((entry, i) => {
      if (
        !this._activeFilters.has('all') &&
        !this._activeFilters.has(resourceType(entry))
      )
        return;
      visIdx++;

      const type = resourceType(entry);
      const { barH } = typeConfig(type);
      const status = entry.response.status;
      const size = entry.response._transferSize ?? entry.response.bodySize;
      const { domain, path } = parseUrl(entry.request.url);

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
        `wf-row--rh${barH + 10}`,
        isBlocking(entry) ? 'row--blocking' : '',
        this._openPanels.has(i) ? 'row--open' : '',
      ]
        .filter(Boolean)
        .join(' ');

      const li = el('li', { className: rowClasses });
      li.dataset.index = String(i);

      // # index
      const cellIdx = el(
        'span',
        { className: 'wf-cell wf-cell--idx' },
        String(visIdx),
      );

      // URL (domain + path stacked)
      const cellUrl = el('span', { className: 'wf-cell wf-cell--url' });
      cellUrl.title = entry.request.url;
      cellUrl.appendChild(el('span', { className: 'wf-url-domain' }, domain));
      if (path)
        cellUrl.appendChild(el('span', { className: 'wf-url-path' }, path));

      // Info cells
      const cellMeth = el(
        'span',
        { className: 'wf-cell wf-cell--info' },
        entry.request.method,
      );
      const cellProt = el(
        'span',
        { className: 'wf-cell wf-cell--info' },
        entry.request.httpVersion,
      );
      const cellStat = el(
        'span',
        { className: `wf-cell wf-cell--info wf-cell--stat ${statusCls}` },
        String(status),
      );
      const cellType = el('span', { className: 'wf-cell wf-cell--info' }, type);
      const cellSize = el(
        'span',
        { className: 'wf-cell wf-cell--info wf-cell--size' },
        fmtSize(size),
      );
      const cellDur = el(
        'span',
        { className: 'wf-cell wf-cell--info wf-cell--dur' },
        fmtMs(entry.time),
      );

      li.append(
        cellIdx,
        cellUrl,
        cellMeth,
        cellProt,
        cellStat,
        cellType,
        cellSize,
        cellDur,
      );
      li.appendChild(this._makeTimelineCell(entry));

      li.addEventListener('click', () => this._togglePanel(i, entry));

      this._listEl.appendChild(li);
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Registration
// ─────────────────────────────────────────────────────────────────────────────

if (!customElements.get('waterfall-chart')) {
  customElements.define('waterfall-chart', WaterfallChart);
}
