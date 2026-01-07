class TopNav extends HTMLElement {
  private _activeTab: string = '';

  static get observedAttributes() {
    return ['active'];
  }

  get activeTab(): string {
    return this._activeTab;
  }

  set activeTab(value: string) {
    this._activeTab = value;
    this.setAttribute('active', value);
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue && name === 'active') {
      this._activeTab = newValue || '';
      this.render();
    }
  }

  connectedCallback() {
    // Get active tab from attribute first, then try to auto-detect from URL
    if (!this._activeTab) {
      const activeAttr = this.getAttribute('active');
      if (activeAttr) {
        this._activeTab = activeAttr;
      } else {
        // Auto-detect from URL
        const path = window.location.pathname;
        if (path === '/' || path === '/index' || path === '/home') {
          this._activeTab = 'home';
        } else if (path.startsWith('/basic')) {
          this._activeTab = 'basic';
        } else if (path.startsWith('/advanced')) {
          this._activeTab = 'advanced';
        } else if (path.startsWith('/results')) {
          this._activeTab = 'results';
        } else if (path.startsWith('/upload')) {
          this._activeTab = 'upload';
        } else {
          this._activeTab = '';
        }
      }
    }
    
    this.render();
  }

  private render() {
    const navItems = [
      { name: 'home', label: 'Home', href: '/' },
      { name: 'basic', label: 'Basic', href: '/basic' },
      { name: 'advanced', label: 'Advanced', href: '/advanced' },
      { name: 'results', label: 'Results', href: '/results' },
      { name: 'upload', label: 'Upload', href: '/upload' },
    ];

    this.innerHTML = `
      <nav class="top-nav">
        <a class="brand" href="/">Telescope</a>
        <div class="tabs" part="tabs">
          ${navItems
            .map(
              (item) => {
                const isActive = this._activeTab === item.name;
                const isInactive = item.name === 'results' && !isActive;
                const classes = `tab ${isActive ? 'active' : ''} ${isInactive ? 'inactive' : ''}`;
                const href = item.name === 'home' ? '/' : item.href;
                return `
            <a class="${classes}" href="${href}">
              ${item.label}
            </a>
          `;
              }
            )
            .join('')}
        </div>
        <div class="spacer"></div>
        <a class="gh" href="https://github.com/cloudflare/telescope" target="_blank" rel="noreferrer">
            GitHub ↗
        </a>
      </nav>
    `;
  }
}

customElements.define('top-nav', TopNav);

