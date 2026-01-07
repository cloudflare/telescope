class DataNav extends HTMLElement {
  private _testId: string = '';
  private _currentPage: string = '';

  static get observedAttributes() {
    return ['test-id', 'current-page', 'active'];
  }

  get testId(): string {
    return this._testId;
  }

  set testId(value: string) {
    this._testId = value;
    this.setAttribute('test-id', value);
  }

  get currentPage(): string {
    return this._currentPage;
  }

  set currentPage(value: string) {
    this._currentPage = value;
    this.setAttribute('current-page', value);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      if (name === 'test-id') {
        this._testId = newValue || '';
      } else if (name === 'current-page' || name === 'active') {
        this._currentPage = newValue || '';
      }
      this.render();
    }
  }

  connectedCallback() {
    // Get current page from attribute first, then try to auto-detect from URL
    if (!this._currentPage) {
      const activeAttr = this.getAttribute('active') || this.getAttribute('current-page');
      if (activeAttr) {
        this._currentPage = activeAttr;
        console.log('[DataNav] Current page from attribute:', this._currentPage);
      } else {
        // Auto-detect from URL
        const pathParts = window.location.pathname.split('/').filter(Boolean);
        console.log('[DataNav] Path parts:', pathParts);
        
        const dataIndex = pathParts.indexOf('data');
        if (dataIndex !== -1 && pathParts[dataIndex + 1]) {
          this._currentPage = pathParts[dataIndex + 1];
          console.log('[DataNav] Detected current page from URL:', this._currentPage);
        }
      }
    }
    
    // Auto-detect test ID from URL if not provided
    if (!this._testId) {
      const pathParts = window.location.pathname.split('/').filter(Boolean);
      const pageNames = ['overview', 'filmstrip-video', 'metrics', 'waterfall', 'console', 'resources', 'bottlenecks', 'config'];
      const dataIndex = pathParts.indexOf('data');
      
      if (dataIndex !== -1 && pathParts[dataIndex + 2]) {
        // URL structure: /data/{page}/{testId}
        const possibleTestId = pathParts[dataIndex + 2];
        // Test ID typically contains underscores or hyphens and is not a page name
        if (possibleTestId && !pageNames.includes(possibleTestId)) {
          this._testId = possibleTestId;
          console.log('[DataNav] Detected test ID:', this._testId);
        }
      }
    }
    
    this.render();
  }

  private render() {
    const navItems = [
      { name: 'overview', label: 'Overview' },
      { name: 'filmstrip-video', label: 'Filmstrip & Video' },
      { name: 'metrics', label: 'Metrics' },
      { name: 'waterfall', label: 'Waterfall' },
      { name: 'console', label: 'Console' },
      { name: 'resources', label: 'Resources' },
      { name: 'bottlenecks', label: 'Bottlenecks' },
      { name: 'config', label: 'Config' },
    ];

    const basePath = this._testId ? `/data` : '/data';
    const testIdPath = this._testId ? `/${this._testId}` : '';

    this.innerHTML = `
      <nav class="data-nav">
        <div class="tabs" part="tabs">
          ${navItems
            .map(
              (item) => `
            <a class="tab ${this._currentPage === item.name ? 'active' : ''}" 
               href="${basePath}/${item.name}${testIdPath}">
              ${item.label}
            </a>
          `
            )
            .join('')}
        </div>
      </nav>
    `;
  }
}

customElements.define('data-nav', DataNav);

