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
  private _allGroupEl!: HTMLElement;
  private _filtersEl!: HTMLElement;
  private _phaseGroupEl!: HTMLElement;
  private _eventGroupEl!: HTMLElement;
  private _listWrapEl!: HTMLElement;
  private _colHeadersEl!: HTMLElement;
  private _listEl!: HTMLOListElement;
  private _rulerEl!: HTMLElement;
  private _gridOverlayEl!: HTMLElement;
  private _overlayEl!: HTMLElement;
  private _scrubberEl!: HTMLElement;
  private _loadingEl!: HTMLElement;
  private _errorEl!: HTMLElement;
  private _toggleBtn!: HTMLButtonElement;

  // ── Component state ───────────────────────────────────────────────────────
  private _allEntries: HarEntry[] = [];
  private _activeFilters = new Set<string>(['all']);
  private _activePhaseFilters = new Set<string>();
  private _hiddenEvents = new Set<string>();
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
    this._activePhaseFilters = new Set();
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
    this._gridOverlayEl = this.querySelector(
      '.wf-col-header--timeline .wf-grid-overlay',
    ) as HTMLElement;
    this._overlayEl = this.querySelector(
      '.wf-col-header--timeline .wf-events-overlay',
    ) as HTMLElement;

    // Scrubber is not part of the static HTML — create it and inject it.
    this._scrubberEl = el('div', { className: 'wf-scrubber' });
    this._scrubberEl.appendChild(
      el('span', { className: 'wf-scrubber__label' }),
    );
    this._overlayEl.appendChild(this._scrubberEl);

    this._filtersEl = this.querySelector('.wf-filters') as HTMLElement;
    this._phaseGroupEl = this.querySelector(
      '.wf-legend-group[aria-label="Filter by connection phase"]',
    ) as HTMLElement;
    this._loadingEl = this.querySelector('.wf-loading') as HTMLElement;
    this._errorEl = this.querySelector('.wf-error') as HTMLElement;

    // Hide the loading message (pre-rendered content is already visible)
    if (this._loadingEl) this._loadingEl.hidden = true;

    // Inject the toggle button into the URL header cell (JS-only)
    const urlHeaderEl = this.querySelector(
      '.wf-col-header--url',
    ) as HTMLElement;
    this._toggleBtn = el('button', {
      className: 'wf-toggle-cols',
      'aria-expanded': 'false',
      'aria-label': 'Show columns',
    });
    this._toggleBtn.textContent = '\u2192';
    this._toggleBtn.addEventListener('click', () => this._onToggleCols());
    urlHeaderEl.appendChild(this._toggleBtn);

    // Reconstruct _allEntries from data-* on the <li> rows.
    // We read enough to support filtering, panel rendering, and event lines.
    const rows = Array.from(
      this._listEl.querySelectorAll<HTMLElement>('li[data-index]'),
    );
    this._allEntries = rows.map((li) => this._entryFromRow(li));

    if (!this._allEntries.length) return;

    // Stamp data-type and data-phases on each pre-rendered row.
    rows.forEach((li, i) => {
      const entry = this._allEntries[i]!;
      li.dataset.type = resourceType(entry);

      const blocked =
        parseFloat(li.dataset.blocked ?? '0') +
        parseFloat(li.dataset.blockedQueueing ?? '0');
      const phaseList = (
        [
          ['blocked', blocked],
          ['dns', parseFloat(li.dataset.dns ?? '0')],
          ['connect', parseFloat(li.dataset.connect ?? '0')],
          ['ssl', parseFloat(li.dataset.ssl ?? '0')],
        ] as [string, number][]
      )
        .filter(([, v]) => v > 0)
        .map(([p]) => p)
        .join(' ');
      if (phaseList) li.dataset.phases = phaseList;
    });

    this._totalMs = computeTotalMs(this._allEntries);
    this._originMs = +new Date(this._allEntries[0]!.startedDateTime);
    this._pageTimings = this._readPageTimings();

    // Wire up filter chips — they already have the right labels from SSR
    const chipBtns = Array.from(
      this._filtersEl.querySelectorAll<HTMLButtonElement>('.wf-filter-btn'),
    );
    const types = chipBtns.map(
      (b) => b.textContent?.trim().toLowerCase() ?? '',
    );
    chipBtns.forEach((btn) => {
      const type = btn.textContent?.trim().toLowerCase() ?? '';
      btn.addEventListener('click', () => {
        if (type === 'all') {
          this._activeFilters = new Set(['all']);
          this._activePhaseFilters = new Set();
        } else {
          this._activeFilters.delete('all');
          this._activeFilters.has(type)
            ? this._activeFilters.delete(type)
            : this._activeFilters.add(type);
          if (!this._activeFilters.size && !this._activePhaseFilters.size)
            this._activeFilters = new Set(['all']);
        }
        this._syncFilterChips(types);
        this._syncPhaseChips();
        this._renderRows();
      });
      if (type !== 'all') {
        btn.addEventListener('mouseenter', () => {
          this._listWrapEl.dataset.hoverType = type;
        });
        btn.addEventListener('mouseleave', () => {
          delete this._listWrapEl.dataset.hoverType;
        });
      }
    });

    // Wire up phase filter buttons
    this._phaseGroupEl
      ?.querySelectorAll<HTMLButtonElement>('[data-phase]')
      .forEach((btn) => {
        const phase = btn.dataset.phase!;
        btn.addEventListener('click', () => {
          this._activePhaseFilters.has(phase)
            ? this._activePhaseFilters.delete(phase)
            : this._activePhaseFilters.add(phase);
          if (!this._activeFilters.size && !this._activePhaseFilters.size)
            this._activeFilters = new Set(['all']);
          this._syncFilterChips(types);
          this._syncPhaseChips();
          this._renderRows();
        });
        btn.addEventListener('mouseenter', () => {
          this._listWrapEl.dataset.hoverPhase = phase;
        });
        btn.addEventListener('mouseleave', () => {
          delete this._listWrapEl.dataset.hoverPhase;
        });
      });

    // Build event toggle buttons from actual pageTimings (adopt path).
    // The group may not exist in pre-rendered HTML if no metrics were collected.
    this._eventGroupEl =
      (this.querySelector(
        '.wf-legend-group[aria-label="Toggle metrics"]',
      ) as HTMLElement | null) ??
      (() => {
        const g = el('div', {
          className: 'wf-legend-group',
          role: 'group',
          'aria-label': 'Toggle metrics',
        });
        this.querySelector('.wf-toolbar')?.appendChild(g);
        return g;
      })();
    this._renderEventFilters();

    // Wire up row click → detail panel
    rows.forEach((li, i) => {
      li.addEventListener('click', () =>
        this._togglePanel(i, this._allEntries[i]!),
      );
    });

    this._wireScrubber();

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
        else if (line.classList.contains('wf-event--lcp')) timings._lcp = ms;
      });
    return timings;
  }

  /** Parse ms back out of a formatted label like "DCL 340ms" or "Load 1.23s". */
  private _parseLabelMs(label: string): number {
    const secMatch = label.match(/([\d.]+) ?s$/);
    if (secMatch) return parseFloat(secMatch[1]!) * 1000;
    const msMatch = label.match(/(\d+) ?ms$/);
    if (msMatch) return parseInt(msMatch[1]!, 10);
    return 0;
  }

  // ── Initial DOM construction (dynamic path) ───────────────────────────────

  private _buildDOM() {
    // ── Legend ──────────────────────────────────────────────────────────────
    // ── Toolbar (filters + phase/event legend groups + col toggle) ────────────
    const TYPE_SWATCH: Record<string, string> = {
      html: 'html',
      js: 'js',
      css: 'css',
      image: 'image',
      font: 'font',
      video: 'video',
      other: 'other',
    };

    const mkSwatch = (thin: boolean, key: string) =>
      el('span', {
        className: `wf-swatch wf-swatch--${thin ? 'thin' : 'thick'} wf-swatch--${key}`,
      });

    const mkEventBtn = (key: string, label: string) => {
      const btn = el('button', {
        className: 'wf-filter-btn active',
        'data-event': key,
      });
      btn.append(mkSwatch(true, key), document.createTextNode(label));
      return btn;
    };

    this._allGroupEl = el('div', {
      className: 'wf-legend-group wf-all-group',
      role: 'group',
      'aria-label': 'Reset filters',
    });

    this._filtersEl = el('div', {
      className: 'wf-legend-group wf-filters',
      role: 'group',
      'aria-label': 'Filter by resource type',
    });

    this._phaseGroupEl = el('div', {
      className: 'wf-legend-group',
      role: 'group',
      'aria-label': 'Filter by connection phase',
    });
    for (const [phase, label] of [
      ['blocked', 'Blocked'],
      ['dns', 'DNS Lookup'],
      ['connect', 'TCP Connect'],
      ['ssl', 'TLS Handshake'],
    ] as const) {
      const btn = el('button', { className: 'wf-filter-btn' });
      btn.dataset.phase = phase;
      btn.append(mkSwatch(true, phase), document.createTextNode(label));
      this._phaseGroupEl.appendChild(btn);
    }

    this._eventGroupEl = el('div', {
      className: 'wf-legend-group',
      role: 'group',
      'aria-label': 'Toggle metrics',
    });
    // Buttons are populated later by _renderEventFilters() once pageTimings are known.

    this._toggleBtn = el('button', {
      className: 'wf-toggle-cols',
      'aria-expanded': 'false',
      'aria-label': 'Show columns',
    });
    this._toggleBtn.textContent = '\u2192';
    this._toggleBtn.addEventListener('click', () => this._onToggleCols());

    const toolbar = el('div', { className: 'wf-toolbar' });
    toolbar.append(
      this._allGroupEl,
      this._filtersEl,
      this._phaseGroupEl,
      this._eventGroupEl,
    );

    // ── List wrapper ──────────────────────────────────────────────────────────

    // Column header row
    this._rulerEl = el('div', { className: 'wf-ruler', 'aria-hidden': 'true' });
    this._gridOverlayEl = el('div', {
      className: 'wf-grid-overlay',
      'aria-hidden': 'true',
    });
    this._overlayEl = el('div', {
      className: 'wf-events-overlay',
      'aria-hidden': 'true',
    });
    this._scrubberEl = el('div', { className: 'wf-scrubber' });
    this._scrubberEl.appendChild(
      el('span', { className: 'wf-scrubber__label' }),
    );
    this._overlayEl.appendChild(this._scrubberEl);
    const timelineHeader = el('div', {
      className: 'wf-col-header wf-col-header--timeline',
    });
    timelineHeader.append(this._rulerEl, this._gridOverlayEl, this._overlayEl);

    this._colHeadersEl = el('div', {
      className: 'wf-col-headers',
      'aria-hidden': 'true',
    });
    const urlHeader = el('div', {
      className: 'wf-col-header wf-col-header--url',
    });
    urlHeader.append(document.createTextNode('URL'), this._toggleBtn);

    this._colHeadersEl.append(
      el('div', { className: 'wf-col-header wf-col-header--idx' }, '#'),
      urlHeader,
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
    this._listWrapEl.append(this._colHeadersEl, this._listEl);
    this._wireScrubber();

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
    this.append(toolbar, this._listWrapEl, this._loadingEl, this._errorEl);
  }

  // ── Column toggle ─────────────────────────────────────────────────────────

  private _onToggleCols() {
    const expanded = this._toggleBtn.getAttribute('aria-expanded') === 'true';
    if (expanded) {
      this._listWrapEl.classList.remove('cols-expanded');
      this._toggleBtn.setAttribute('aria-expanded', 'false');
      this._toggleBtn.setAttribute('aria-label', 'Show columns');
      this._toggleBtn.textContent = '\u2192';
    } else {
      this._listWrapEl.classList.add('cols-expanded');
      this._toggleBtn.setAttribute('aria-expanded', 'true');
      this._toggleBtn.setAttribute('aria-label', 'Hide columns');
      this._toggleBtn.textContent = '\u2190';
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
      const types = uniqueTypes(entries);
      this._renderFilters(types);
      this._renderPhaseFilters(types);
      this._renderEventFilters();
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
    this._activePhaseFilters = new Set();
    this._hiddenEvents = new Set();
    this._openPanels.clear();
    this._pageTimings = {};
    this._totalMs = 0;
    this._originMs = 0;
    this._listEl.innerHTML = '';
    this._filtersEl.innerHTML = '';
    this._rulerEl.innerHTML = '';
    this._gridOverlayEl.innerHTML = '';
    this._overlayEl.innerHTML = '';
    this._overlayEl.appendChild(this._scrubberEl);
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
    const TYPE_SWATCH: Record<string, string> = {
      html: 'html',
      js: 'js',
      css: 'css',
      image: 'image',
      font: 'font',
      video: 'video',
      other: 'other',
    };
    const TYPE_LABEL: Record<string, string> = {
      html: 'HTML',
      js: 'JS',
      css: 'CSS',
    };
    this._filtersEl.innerHTML = '';
    for (const type of types) {
      const active =
        type === 'all'
          ? this._activeFilters.has('all') &&
            this._activePhaseFilters.size === 0
          : this._activeFilters.has(type);
      const btn = el('button', {
        className: `wf-filter-btn${active ? ' active' : ''}`,
      });
      const key = TYPE_SWATCH[type];
      if (key) {
        btn.appendChild(
          el('span', {
            className: `wf-swatch wf-swatch--thick wf-swatch--${key}`,
          }),
        );
      }
      btn.appendChild(document.createTextNode(TYPE_LABEL[type] ?? type));
      btn.addEventListener('click', () => {
        if (type === 'all') {
          this._activeFilters = new Set(['all']);
          this._activePhaseFilters = new Set();
        } else {
          this._activeFilters.delete('all');
          this._activeFilters.has(type)
            ? this._activeFilters.delete(type)
            : this._activeFilters.add(type);
          if (!this._activeFilters.size && !this._activePhaseFilters.size)
            this._activeFilters = new Set(['all']);
        }
        this._renderFilters(types);
        this._renderPhaseFilters(types);
        this._renderRows();
      });
      if (type !== 'all') {
        btn.addEventListener('mouseenter', () => {
          this._listWrapEl.dataset.hoverType = type;
        });
        btn.addEventListener('mouseleave', () => {
          delete this._listWrapEl.dataset.hoverType;
        });
      }
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
      const isActive =
        type === 'all'
          ? this._activeFilters.has('all') &&
            this._activePhaseFilters.size === 0
          : this._activeFilters.has(type);
      btn.classList.toggle('active', isActive);
    });
  }

  /** Build phase filter buttons for the dynamic (JS-rendered) path. */
  private _renderPhaseFilters(types: string[]) {
    this._phaseGroupEl.innerHTML = '';
    for (const [phase, label] of [
      ['blocked', 'Blocked'],
      ['dns', 'DNS Lookup'],
      ['connect', 'TCP Connect'],
      ['ssl', 'TLS Handshake'],
    ] as const) {
      const active = this._activePhaseFilters.has(phase);
      const btn = el('button', {
        className: `wf-filter-btn${active ? ' active' : ''}`,
      });
      btn.dataset.phase = phase;
      btn.append(
        el('span', {
          className: `wf-swatch wf-swatch--thin wf-swatch--${phase}`,
        }),
        document.createTextNode(label),
      );
      btn.addEventListener('click', () => {
        this._activePhaseFilters.has(phase)
          ? this._activePhaseFilters.delete(phase)
          : this._activePhaseFilters.add(phase);
        if (!this._activeFilters.size && !this._activePhaseFilters.size)
          this._activeFilters = new Set(['all']);
        this._renderFilters(types);
        this._renderPhaseFilters(types);
        this._renderRows();
      });
      btn.addEventListener('mouseenter', () => {
        this._listWrapEl.dataset.hoverPhase = phase;
      });
      btn.addEventListener('mouseleave', () => {
        delete this._listWrapEl.dataset.hoverPhase;
      });
      this._phaseGroupEl.appendChild(btn);
    }
  }

  /** Sync active/inactive CSS classes on phase filter buttons (adopt path). */
  private _syncPhaseChips() {
    this._phaseGroupEl
      ?.querySelectorAll<HTMLButtonElement>('[data-phase]')
      .forEach((btn) => {
        btn.classList.toggle(
          'active',
          this._activePhaseFilters.has(btn.dataset.phase!),
        );
      });
  }

  /**
   * Build event toggle buttons from the current _pageTimings — one button per
   * metric that has a positive value. Replaces any previously rendered buttons.
   * Also hides the group entirely when no metrics are present.
   */
  private _renderEventFilters() {
    this._eventGroupEl.innerHTML = '';

    const EVENTS: Array<{
      key: string;
      label: string;
      hasValue: boolean;
    }> = [
      {
        key: 'ev-dcl',
        label: 'DOM Content Loaded',
        hasValue: (this._pageTimings.onContentLoad ?? 0) > 0,
      },
      {
        key: 'ev-load',
        label: 'Page Load',
        hasValue: (this._pageTimings.onLoad ?? 0) > 0,
      },
      {
        key: 'ev-lcp',
        label: 'Largest Contentful Paint',
        hasValue: (this._pageTimings._lcp ?? 0) > 0,
      },
    ];

    const present = EVENTS.filter((e) => e.hasValue);
    this._eventGroupEl.hidden = present.length === 0;

    for (const { key, label } of present) {
      const btn = el('button', {
        className: 'wf-filter-btn active',
        'data-event': key,
      });
      btn.append(
        el('span', {
          className: `wf-swatch wf-swatch--thin wf-swatch--${key}`,
        }),
        document.createTextNode(label),
      );
      btn.addEventListener('click', () => {
        this._hiddenEvents.has(key)
          ? this._hiddenEvents.delete(key)
          : this._hiddenEvents.add(key);
        this._syncEventChips();
        this._renderEventLines();
      });
      this._eventGroupEl.appendChild(btn);
    }
  }

  /** Sync active/inactive CSS classes on event toggle buttons. */
  private _syncEventChips() {
    this._eventGroupEl
      ?.querySelectorAll<HTMLButtonElement>('[data-event]')
      .forEach((btn) => {
        btn.classList.toggle(
          'active',
          !this._hiddenEvents.has(btn.dataset.event!),
        );
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
      ['wb--ssl wb--phase', ssl, 'TLS Handshake'],
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

    const barEndPct = (offsetPct + (entry.time / this._totalMs) * 100).toFixed(
      4,
    );
    cell.style.setProperty('--wf-bar-end', `${barEndPct}%`);

    const durLabel = el('span', { className: 'wf-bar-dur' });
    durLabel.textContent = `${Math.round(entry.time)} ms`;

    wrap.appendChild(durLabel);
    cell.append(wrap);
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
      ['wb--ssl', 'TLS Handshake', Math.max(0, t.ssl ?? 0)],
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

  private _tickPositions(): number[] {
    const targets = [50, 100, 200, 250, 500, 1000, 2000, 5000] as const;
    const interval: number = (targets.find((t) => t >= this._totalMs / 8) ??
      targets[targets.length - 1])!;
    const positions: number[] = [];
    for (let ms = interval; ms < this._totalMs; ms += interval)
      positions.push(ms);
    return positions;
  }

  private _renderRuler() {
    this._rulerEl.innerHTML = '';
    for (const ms of this._tickPositions()) {
      const tick = el('span', { className: 'wf-tick' });
      tick.style.left = `${(ms / this._totalMs) * 100}%`;
      tick.textContent = `${parseFloat((ms / 1000).toFixed(3))}s`;
      this._rulerEl.appendChild(tick);
    }
  }

  // ── Event lines ───────────────────────────────────────────────────────────

  private _renderEventLines() {
    this._gridOverlayEl.innerHTML = '';
    this._overlayEl.innerHTML = '';
    if (this._totalMs <= 0) return;

    // Both overlays live inside .wf-col-header--timeline, so their width equals
    // the timeline column width. left:X% therefore aligns with ruler ticks and
    // bar positions — same coordinate space, no measurement needed.

    // Size the overlays to exactly match the list-wrap height so they don't
    // extend beyond the component boundary.
    const h = `${this._listWrapEl.offsetHeight}px`;
    this._listWrapEl.style.setProperty('--wf-overlay-h', h);

    // Grid lines — in the low-z-index overlay so they render behind the bars.
    for (const ms of this._tickPositions()) {
      const gridLine = el('div', { className: 'wf-grid-line' });
      gridLine.style.left = `${(ms / this._totalMs) * 100}%`;
      this._gridOverlayEl.appendChild(gridLine);
    }

    // Event lines (DCL, Load) — in the high-z-index overlay, in front of bars.
    for (const { ms, cls, label } of pageEvents(
      this._pageTimings,
      this._totalMs,
    )) {
      const eventKey = 'ev-' + cls.replace('wf-event--', '');
      if (this._hiddenEvents.has(eventKey)) continue; // skip hidden metrics
      const line = el('div', { className: `wf-event-line ${cls}` });
      line.dataset.label = fmtEventLabel(label, ms);
      line.dataset.name = label;
      line.style.left = `${(ms / this._totalMs) * 100}%`;
      this._overlayEl.appendChild(line);
    }

    // Scrubber must always be the last child of the overlay so it renders
    // on top of event lines.
    this._overlayEl.appendChild(this._scrubberEl);
  }

  // ── Scrubber ──────────────────────────────────────────────────────────────

  private _wireScrubber() {
    const label = this._scrubberEl.querySelector(
      '.wf-scrubber__label',
    ) as HTMLElement;

    // Snap threshold in CSS pixels: scrubber locks to a metric when closer
    // than this many pixels.
    const SNAP_PX = 8;

    // Track which event line the scrubber is currently snapped to so we can
    // remove the snapped class when it moves away.
    let snappedLine: HTMLElement | null = null;

    const snapTo = (line: HTMLElement) => {
      if (snappedLine === line) return;
      if (snappedLine) snappedLine.classList.remove('wf-event-line--snapped');
      snappedLine = line;
      line.classList.add('wf-event-line--snapped');
    };

    const unsnap = () => {
      if (snappedLine) snappedLine.classList.remove('wf-event-line--snapped');
      snappedLine = null;
    };

    this._listWrapEl.addEventListener('mousemove', (e: MouseEvent) => {
      if (this._totalMs <= 0) return;
      const rect = this._overlayEl.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.min(1, Math.max(0, x / rect.width));

      // Find the closest event line within snap threshold.
      const eventLines = Array.from(
        this._overlayEl.querySelectorAll<HTMLElement>('.wf-event-line'),
      );
      let closest: HTMLElement | null = null;
      let closestDx = Infinity;
      for (const line of eventLines) {
        const linePct = parseFloat(line.style.left) / 100;
        const linePx = linePct * rect.width;
        const dx = Math.abs(x - linePx);
        if (dx < closestDx) {
          closestDx = dx;
          closest = line;
        }
      }

      if (closest && closestDx <= SNAP_PX) {
        // Snap: hide scrubber, show metric label.
        snapTo(closest);
        this._scrubberEl.classList.remove('wf-scrubber--visible');
      } else {
        // Free: show scrubber with cursor position in ms.
        const ms = Math.round(pct * this._totalMs);
        this._scrubberEl.style.left = `${pct * 100}%`;
        label.textContent = `${ms} ms`;
        unsnap();
        this._scrubberEl.classList.add('wf-scrubber--visible');
      }
    });

    this._listWrapEl.addEventListener('mouseleave', () => {
      this._scrubberEl.classList.remove('wf-scrubber--visible');
      unsnap();
    });
  }

  // ── Render rows (<li> items) ──────────────────────────────────────────────

  private _rowPasses(entry: HarEntry): boolean {
    if (
      !this._activeFilters.has('all') &&
      !this._activeFilters.has(resourceType(entry))
    )
      return false;
    if (this._activePhaseFilters.size > 0) {
      const t = entry.timings;
      const phaseVal: Record<string, number> = {
        blocked: Math.max(0, (t.blocked ?? 0) + (t._blocked_queueing ?? 0)),
        dns: Math.max(0, t.dns),
        connect: Math.max(0, t.connect),
        ssl: Math.max(0, t.ssl ?? 0),
      };
      return [...this._activePhaseFilters].some((p) => (phaseVal[p] ?? 0) > 0);
    }
    return true;
  }

  private _renderRows() {
    // If rows already exist, just show/hide them — preserving DOM indexes.
    const existing =
      this._listEl.querySelectorAll<HTMLElement>('li[data-index]');
    if (existing.length > 0) {
      existing.forEach((li) => {
        const i = Number(li.dataset.index);
        const entry = this._allEntries[i];
        li.style.display = entry && this._rowPasses(entry) ? '' : 'none';
      });
      return;
    }

    // Initial build — create one <li> per entry and leave filtering to CSS.
    this._allEntries.forEach((entry, i) => {
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
      li.dataset.type = type;
      const t = entry.timings;
      const phases = (
        [
          [
            'blocked',
            Math.max(0, (t.blocked ?? 0) + (t._blocked_queueing ?? 0)),
          ],
          ['dns', Math.max(0, t.dns)],
          ['connect', Math.max(0, t.connect)],
          ['ssl', Math.max(0, t.ssl ?? 0)],
        ] as [string, number][]
      )
        .filter(([, v]) => v > 0)
        .map(([p]) => p)
        .join(' ');
      if (phases) li.dataset.phases = phases;

      // # index — always the original 1-based position
      const cellIdx = el(
        'span',
        { className: 'wf-cell wf-cell--idx' },
        String(i + 1),
      );

      // URL (domain + path inline)
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
