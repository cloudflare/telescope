const template = document.createElement('template');
template.innerHTML = `
  <style>
    :host {
      display: block;
      position: sticky;
      top: 0;
      z-index: 10;
      backdrop-filter: blur(10px);
      background: rgba(7, 10, 18, 0.65);
      border-bottom: 1px solid rgba(255, 255, 255, 0.10);
    }
    nav {
      width: min(1100px, calc(100% - 48px));
      margin: 0 auto;
      padding: 14px 0;
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .brand {
      font-weight: 700;
      letter-spacing: -0.02em;
      color: rgba(255,255,255,0.92);
      text-decoration: none;
      padding: 8px 10px;
      border-radius: 12px;
    }
    .tabs {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    a.tab {
      color: rgba(255,255,255,0.72);
      text-decoration: none;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid transparent;
      font-size: 14px;
    }
    a.tab:hover {
      border-color: rgba(255,255,255,0.14);
      background: rgba(255,255,255,0.05);
      color: rgba(255,255,255,0.92);
    }
    a.tab[data-active="true"] {
      color: rgba(255,255,255,0.95);
      border-color: rgba(125, 211, 252, 0.35);
      background: linear-gradient(
        135deg,
        rgba(125, 211, 252, 0.10),
        rgba(167, 139, 250, 0.10)
      );
    }
    .spacer {
      flex: 1;
    }
    .gh {
      color: rgba(255,255,255,0.72);
      text-decoration: none;
      padding: 8px 10px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.14);
      font-size: 14px;
      white-space: nowrap;
    }
    .gh:hover {
      color: rgba(255,255,255,0.92);
      border-color: rgba(125, 211, 252, 0.35);
    }
  </style>
  <nav>
    <a class="brand" href="/" data-link>Telescope</a>
    <div class="tabs" part="tabs">
      <a class="tab" href="/" data-link data-page="Home">Home</a>
      <a class="tab" href="/basic" data-link data-page="Basic">Basic</a>
      <a class="tab" href="/advanced" data-link data-page="Advanced">Advanced</a>
      <a class="tab" href="/results" data-link data-page="Results">Results</a>
      <a class="tab" href="/upload" data-link data-page="Upload">Upload</a>
    </div>
    <div class="spacer"></div>
    <a class="gh" href="https://github.com/cloudflare/telescope" target="_blank" rel="noreferrer">
      GitHub ↗
    </a>
  </nav>
`;

export class TopNav extends HTMLElement {
  static observedAttributes = ['active'];
  #root: ShadowRoot;

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.appendChild(template.content.cloneNode(true));
  }

  connectedCallback() {
    this.#syncActive();
  }

  attributeChangedCallback() {
    this.#syncActive();
  }

  #syncActive() {
    const active = (this.getAttribute('active') || '').trim();
    const tabs = this.#root.querySelectorAll<HTMLAnchorElement>('a.tab[data-page]');
    tabs.forEach(t => {
      t.dataset.active = String(t.dataset.page === active);
    });
  }
}

customElements.define('top-nav', TopNav);


