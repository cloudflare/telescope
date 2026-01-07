export class DataMenu extends HTMLElement {
  static observedAttributes = ['test-id', 'active'];
  private _testId = '';
  private _active = '';

  connectedCallback() {
    this.render();
  }

  attributeChangedCallback(name: string, _old: string, newVal: string) {
    if (name === 'test-id') this._testId = newVal;
    if (name === 'active') this._active = newVal;
    this.render();
  }

  render() {
    if (!this._testId) {
      this.innerHTML = '';
      return;
    }

    const pages = [
      { id: 'overview', label: 'Overview' },
      { id: 'filmstrip', label: 'Filmstrip & Video' },
      { id: 'metrics', label: 'Metrics' },
      { id: 'console', label: 'Console' },
      { id: 'resources', label: 'Resources' },
      { id: 'waterfall', label: 'Waterfall' },
      { id: 'critical-path', label: 'Critical Path' },
      { id: 'bottlenecks', label: 'Bottlenecks' },
      { id: 'config', label: 'Config' },
    ];

    this.innerHTML = `
      <nav style="
        position: fixed;
        left: 0;
        top: 60px;
        bottom: 0;
        width: 240px;
        background: rgba(7, 10, 18, 0.95);
        border-right: 1px solid rgba(255,255,255,0.12);
        padding: 24px 16px;
        overflow-y: auto;
        z-index: 9;
        backdrop-filter: blur(10px);
      ">
        <div style="margin-bottom: 24px;">
          <a href="/results" data-link style="color: rgba(125,211,252,0.92); text-decoration: none; font-size: 14px; display: flex; align-items: center; gap: 8px;">
            ← Back to Results
          </a>
        </div>
        <div style="display: flex; flex-direction: column; gap: 4px;">
          ${pages
            .map(
              p => `
            <a href="/data/${p.id}/${encodeURIComponent(this._testId)}" 
               data-link
               style="
                 padding: 12px 16px;
                 border-radius: 8px;
                 text-decoration: none;
                 color: ${this._active === p.id ? 'rgba(125,211,252,0.92)' : 'rgba(255,255,255,0.7)'};
                 background: ${this._active === p.id ? 'rgba(125,211,252,0.15)' : 'transparent'};
                 font-size: 14px;
                 font-weight: ${this._active === p.id ? '500' : '400'};
                 transition: all 0.2s;
                 display: block;
               "
               onmouseover="this.style.background='${this._active === p.id ? 'rgba(125,211,252,0.2)' : 'rgba(255,255,255,0.08)'}'"
               onmouseout="this.style.background='${this._active === p.id ? 'rgba(125,211,252,0.15)' : 'transparent'}'"
            >${p.label}</a>
          `,
            )
            .join('')}
        </div>
      </nav>
    `;
  }
}

customElements.define('data-menu', DataMenu);

