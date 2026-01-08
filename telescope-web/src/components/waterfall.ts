interface Resource {
  index: number;
  name: string;
  url: string;
  startTime: number;
  duration: number;
  method: string;
  status: number;
  size: number;
  type: string;
  nextHopProtocol?: string;
  transferSize?: number;
  decodedBodySize?: number;
  fetchStart?: number;
  domainLookupStart?: number;
  domainLookupEnd?: number;
  connectStart?: number;
  connectEnd?: number;
  secureConnectionStart?: number;
  requestStart?: number;
  responseStart?: number;
  responseEnd?: number;
  initiatorType?: string;
  renderBlockingStatus?: string;
  contentType?: string;
  isCriticalPath?: boolean;
}

interface WaterfallData {
  resources: Resource[];
  startTime: number;
  totalDuration: number;
}

interface Filters {
  fileTypes?: string[];
  statusCodes?: string[];
  methods?: string[];
  domains?: string[];
  protocols?: string[];
}

class WaterfallChart extends HTMLElement {
  private _data: WaterfallData | null = null;
  private _visibleColumns: Set<string> = new Set(['index', 'url']);
  private _timeScale: number = 1;
  private _showOnlyCriticalPath: boolean = false;
  private _filters: Filters = {};

  static get observedAttributes() {
    return ['data', 'columns', 'filters'];
  }

  set data(value: WaterfallData | null) {
    this._data = value;
    this.render();
  }

  get data(): WaterfallData | null {
    return this._data;
  }

  set visibleColumns(value: string[]) {
    this._visibleColumns = new Set(value);
    this.render();
  }

  get visibleColumns(): string[] {
    return Array.from(this._visibleColumns);
  }

  set showOnlyCriticalPath(value: boolean) {
    this._showOnlyCriticalPath = value;
    this.render();
  }

  get showOnlyCriticalPath(): boolean {
    return this._showOnlyCriticalPath;
  }

  set filters(value: Filters) {
    this._filters = value || {};
    this.render();
  }

  get filters(): Filters {
    return this._filters;
  }

  attributeChangedCallback(name: string, _oldValue: string, newValue: string) {
    if (name === 'data' && newValue) {
      try {
        this._data = JSON.parse(newValue);
        this.render();
      } catch (e) {
        console.error('Error parsing waterfall data:', e);
      }
    } else if (name === 'columns' && newValue) {
      try {
        this._visibleColumns = new Set(JSON.parse(newValue));
        this.render();
      } catch (e) {
        console.error('Error parsing columns:', e);
      }
    } else if (name === 'filters' && newValue) {
      try {
        this._filters = JSON.parse(newValue);
        this.render();
      } catch (e) {
        console.error('Error parsing filters:', e);
      }
    }
  }

  connectedCallback() {
    this.render();
  }

  private render() {
    if (!this._data || !this._data.resources || this._data.resources.length === 0) {
      this.innerHTML = '<div style="padding: 20px; text-align: center; color: rgba(255, 255, 255, 0.72);">No waterfall data available</div>';
      return;
    }

    const { resources, totalDuration } = this._data;
    this._timeScale = totalDuration > 0 ? 100 / totalDuration : 1;

    // Calculate column widths
    const columnWidths = this.calculateColumnWidths();

    this.innerHTML = `
      <style>
        .waterfall-container {
          overflow-x: auto;
          overflow-y: auto;
          max-height: 80vh;
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          background: rgba(0, 0, 0, 0.2);
        }
        .waterfall-header {
          display: flex;
          background: rgba(255, 255, 255, 0.05);
          border-bottom: 1px solid rgba(255, 255, 255, 0.12);
          position: sticky;
          top: 0;
          z-index: 10;
        }
        .waterfall-header-cell {
          padding: 12px;
          font-weight: 600;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          border-right: 1px solid rgba(255, 255, 255, 0.12);
          white-space: nowrap;
          min-width: 80px;
        }
        .waterfall-row {
          display: flex;
          border-bottom: 1px solid rgba(255, 255, 255, 0.05);
          transition: background 0.2s ease;
        }
        .waterfall-row:hover {
          background: rgba(255, 255, 255, 0.03);
        }
        .waterfall-row.critical-path {
          background: rgba(239, 68, 68, 0.15);
        }
        .waterfall-row.critical-path:hover {
          background: rgba(239, 68, 68, 0.20);
        }
        .waterfall-cell {
          padding: 8px 12px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.85);
          border-right: 1px solid rgba(255, 255, 255, 0.05);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          min-width: 80px;
        }
        .waterfall-cell.index {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          text-align: center;
          color: rgba(255, 255, 255, 0.6);
        }
        .waterfall-cell.url {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          max-width: 400px;
        }
        .waterfall-cell.method {
          text-transform: uppercase;
          font-weight: 600;
        }
        .waterfall-cell.status {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace;
          font-weight: 600;
        }
        .waterfall-cell.status.status-2xx {
          color: rgba(74, 222, 128, 0.9);
        }
        .waterfall-cell.status.status-3xx {
          color: rgba(251, 191, 36, 0.9);
        }
        .waterfall-cell.status.status-4xx,
        .waterfall-cell.status.status-5xx {
          color: rgba(239, 68, 68, 0.9);
        }
        .waterfall-timeline {
          position: relative;
          height: 24px;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 4px;
          overflow: hidden;
        }
        .waterfall-timeline-bar {
          position: absolute;
          height: 100%;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 10px;
          color: rgba(255, 255, 255, 0.9);
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s ease;
        }
        .waterfall-timeline-bar:hover {
          opacity: 0.8;
        }
        .waterfall-timeline-phase {
          position: absolute;
          height: 100%;
          border-right: 1px solid rgba(255, 255, 255, 0.2);
        }
        .waterfall-timeline-phase.dns {
          background: rgba(167, 139, 250, 0.4);
        }
        .waterfall-timeline-phase.connect {
          background: rgba(251, 191, 36, 0.4);
        }
        .waterfall-timeline-phase.request {
          background: rgba(34, 211, 238, 0.4);
        }
        .waterfall-timeline-phase.response {
          background: rgba(74, 222, 128, 0.4);
        }
      </style>
      <div class="waterfall-container">
        <div class="waterfall-header">
          ${this.renderHeader(columnWidths)}
        </div>
        <div class="waterfall-body">
          ${this.getFilteredResources(resources).map((resource) => this.renderRow(resource, resource.index - 1, columnWidths)).join('')}
        </div>
      </div>
    `;
  }

  private getFilteredResources(resources: Resource[]): Resource[] {
    let filtered = resources;

    // Apply critical path filter
    if (this._showOnlyCriticalPath) {
      filtered = filtered.filter(resource => resource.isCriticalPath === true);
    }

    // Apply file type filter
    if (this._filters.fileTypes && this._filters.fileTypes.length > 0) {
      filtered = filtered.filter(resource => 
        this._filters.fileTypes!.includes(resource.type)
      );
    }

    // Apply status code filter
    if (this._filters.statusCodes && this._filters.statusCodes.length > 0) {
      filtered = filtered.filter(resource => 
        this._filters.statusCodes!.includes(String(resource.status))
      );
    }

    // Apply method filter
    if (this._filters.methods && this._filters.methods.length > 0) {
      filtered = filtered.filter(resource => 
        this._filters.methods!.includes(resource.method)
      );
    }

    // Apply domain filter
    if (this._filters.domains && this._filters.domains.length > 0) {
      filtered = filtered.filter(resource => {
        try {
          const url = new URL(resource.url);
          return this._filters.domains!.includes(url.hostname);
        } catch {
          return false;
        }
      });
    }

    // Apply protocol filter
    if (this._filters.protocols && this._filters.protocols.length > 0) {
      filtered = filtered.filter(resource => {
        try {
          const url = new URL(resource.url);
          return this._filters.protocols!.includes(url.protocol.replace(':', ''));
        } catch {
          return this._filters.protocols!.includes(resource.nextHopProtocol || '');
        }
      });
    }

    return filtered;
  }

  private calculateColumnWidths(): Record<string, number> {
    const widths: Record<string, number> = {
      index: 60,
      url: 300,
      method: 80,
      status: 80,
      size: 100,
      duration: 100,
      type: 120,
      protocol: 100,
      timeline: 400,
    };
    return widths;
  }

  private renderHeader(columnWidths: Record<string, number>): string {
    const columns = [
      { key: 'index', label: '#', alwaysVisible: true },
      { key: 'url', label: 'URL', alwaysVisible: true },
      { key: 'method', label: 'Method' },
      { key: 'status', label: 'Status' },
      { key: 'size', label: 'Size' },
      { key: 'duration', label: 'Duration' },
      { key: 'type', label: 'Type' },
      { key: 'protocol', label: 'Protocol' },
      { key: 'timeline', label: 'Timeline' },
    ];

    return columns
      .filter(col => col.alwaysVisible || this._visibleColumns.has(col.key))
      .map(col => `<div class="waterfall-header-cell" style="width: ${columnWidths[col.key] || 100}px;">${this.escapeHtml(col.label)}</div>`)
      .join('');
  }

  private renderRow(resource: Resource, _index: number, columnWidths: Record<string, number>): string {
    const statusClass = this.getStatusClass(resource.status);
    const timelinePhases = this.renderTimelinePhases(resource);

    const cells = [
      { key: 'index', value: String(resource.index), class: 'index' },
      { key: 'url', value: this.elideUrl(resource.url, 50), class: 'url' },
      { key: 'method', value: resource.method || 'GET', class: 'method' },
      { key: 'status', value: String(resource.status || 0), class: `status ${statusClass}` },
      { key: 'size', value: this.formatBytes(resource.size || 0) },
      { key: 'duration', value: this.formatTime(resource.duration || 0) },
      { key: 'type', value: resource.type || 'other' },
      { key: 'protocol', value: resource.nextHopProtocol || 'unknown' },
      { key: 'timeline', value: timelinePhases, class: 'timeline', isHtml: true },
    ];

    const visibleCells = cells.filter(cell => 
      cell.key === 'index' || cell.key === 'url' || this._visibleColumns.has(cell.key)
    );

    const criticalPathClass = resource.isCriticalPath ? 'critical-path' : '';
    const resourceIndex = resource.index - 1; // Convert from 1-based to 0-based
    return `
      <div class="waterfall-row ${criticalPathClass}" data-resource-index="${resourceIndex}" onclick="if(window.openWaterfallPanel) { event.stopPropagation(); window.openWaterfallPanel(${resourceIndex}); }">
        ${visibleCells.map(cell => `
          <div class="waterfall-cell ${cell.class || ''}" style="width: ${columnWidths[cell.key] || 100}px;">
            ${cell.isHtml ? cell.value : this.escapeHtml(cell.value)}
          </div>
        `).join('')}
      </div>
    `;
  }

  private renderTimelinePhases(resource: Resource): string {
    const left = ((resource.startTime - this._data!.startTime) * this._timeScale);
    const width = (resource.duration * this._timeScale);

    if (!resource.fetchStart && !resource.requestStart) {
      return `<div class="waterfall-timeline" style="position: relative; width: 100%;">
        <div class="waterfall-timeline-bar" style="left: ${left}%; width: ${width}%; background: rgba(125, 211, 252, 0.4);" title="${this.formatTime(resource.duration)}">
        </div>
      </div>`;
    }

    const fetchStart = resource.fetchStart || resource.startTime;
    const domainLookupStart = resource.domainLookupStart || fetchStart;
    const domainLookupEnd = resource.domainLookupEnd || domainLookupStart;
    const connectStart = resource.connectStart || domainLookupEnd;
    const connectEnd = resource.connectEnd || connectStart;
    const requestStart = resource.requestStart || connectEnd;
    const responseStart = resource.responseStart || requestStart;
    const responseEnd = resource.responseEnd || responseStart;
    const dnsStart = (domainLookupStart - this._data!.startTime) * this._timeScale;
    const dnsWidth = ((domainLookupEnd - domainLookupStart) * this._timeScale);
    const connectStartPct = (connectStart - this._data!.startTime) * this._timeScale;
    const connectWidth = ((connectEnd - connectStart) * this._timeScale);
    const requestStartPct = (requestStart - this._data!.startTime) * this._timeScale;
    const requestWidth = ((responseStart - requestStart) * this._timeScale);
    const responseStartPct = (responseStart - this._data!.startTime) * this._timeScale;
    const responseWidth = ((responseEnd - responseStart) * this._timeScale);

    return `
      <div class="waterfall-timeline" style="position: relative; width: 100%;">
        ${dnsWidth > 0 ? `<div class="waterfall-timeline-phase dns" style="left: ${dnsStart}%; width: ${dnsWidth}%;" title="DNS: ${this.formatTime(domainLookupEnd - domainLookupStart)}"></div>` : ''}
        ${connectWidth > 0 ? `<div class="waterfall-timeline-phase connect" style="left: ${connectStartPct}%; width: ${connectWidth}%;" title="Connect: ${this.formatTime(connectEnd - connectStart)}"></div>` : ''}
        ${requestWidth > 0 ? `<div class="waterfall-timeline-phase request" style="left: ${requestStartPct}%; width: ${requestWidth}%;" title="Request: ${this.formatTime(responseStart - requestStart)}"></div>` : ''}
        ${responseWidth > 0 ? `<div class="waterfall-timeline-phase response" style="left: ${responseStartPct}%; width: ${responseWidth}%;" title="Response: ${this.formatTime(responseEnd - responseStart)}"></div>` : ''}
      </div>
    `;
  }

  private getStatusClass(status: number): string {
    if (status >= 200 && status < 300) return 'status-2xx';
    if (status >= 300 && status < 400) return 'status-3xx';
    if (status >= 400 && status < 500) return 'status-4xx';
    if (status >= 500) return 'status-5xx';
    return '';
  }

  private formatTime(ms: number): string {
    if (ms === 0 || !ms) return '0ms';
    if (ms < 1000) return `${Math.round(ms)}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
  }

  private elideUrl(url: string, maxLength: number): string {
    if (!url || url.length <= maxLength) return url;
    return '...' + url.substring(url.length - (maxLength - 3));
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('waterfall-chart', WaterfallChart);
