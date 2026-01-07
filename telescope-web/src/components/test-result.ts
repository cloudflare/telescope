type TestResultData = {
  testId: string;
  url: string;
  runTime: string;
  browser: string;
  screenshotUrl: string | null;
};

const tpl = document.createElement('template');
tpl.innerHTML = `
  <style>
    :host {
      display: block;
      cursor: pointer;
      user-select: none;
    }
    .card {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: 14px;
      align-items: center;
      padding: 14px;
      border-radius: 16px;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.06);
      backdrop-filter: blur(10px);
    }
    .card:hover {
      border-color: rgba(125, 211, 252, 0.35);
      background: rgba(255,255,255,0.08);
    }
    .meta {
      display: grid;
      gap: 6px;
      min-width: 0;
    }
    .url {
      font-weight: 700;
      letter-spacing: -0.01em;
      color: rgba(255,255,255,0.92);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .row {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      color: rgba(255,255,255,0.68);
      font-size: 13px;
    }
    .pill {
      border: 1px solid rgba(255,255,255,0.14);
      background: rgba(0,0,0,0.22);
      padding: 4px 8px;
      border-radius: 999px;
    }
    img {
      width: 180px;
      height: 100px;
      object-fit: cover;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.10);
      background: rgba(0,0,0,0.35);
    }
    .fallback {
      width: 180px;
      height: 100px;
      border-radius: 12px;
      border: 1px dashed rgba(255,255,255,0.18);
      display: grid;
      place-items: center;
      color: rgba(255,255,255,0.55);
      font-size: 12px;
    }
  </style>
  <div class="card" role="link" tabindex="0" aria-label="View test result">
    <div class="meta">
      <div class="url" id="url"></div>
      <div class="row">
        <span class="pill" id="browser"></span>
        <span class="pill" id="runtime"></span>
        <span class="pill" id="testid"></span>
      </div>
    </div>
    <div id="shot"></div>
  </div>
`;

export class TestResult extends HTMLElement {
  static observedAttributes = [
    'test-id',
    'url',
    'run-time',
    'browser',
    'screenshot-url',
  ];

  #root: ShadowRoot;
  #data: TestResultData = {
    testId: '',
    url: '',
    runTime: '',
    browser: '',
    screenshotUrl: null,
  };

  constructor() {
    super();
    this.#root = this.attachShadow({ mode: 'open' });
    this.#root.appendChild(tpl.content.cloneNode(true));
  }

  connectedCallback() {
    this.#root.querySelector('.card')?.addEventListener('click', () => {
      const id = this.#data.testId || this.getAttribute('test-id') || '';
      if (!id) return;
      window.location.href = `/data/overview/${encodeURIComponent(id)}`;
    });
    this.#root.querySelector('.card')?.addEventListener('keydown', e => {
      if (e instanceof KeyboardEvent && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        (this.#root.querySelector('.card') as HTMLElement | null)?.click();
      }
    });
    this.#syncFromAttrs();
  }

  attributeChangedCallback() {
    this.#syncFromAttrs();
  }

  set data(next: TestResultData) {
    this.#data = next;
    this.#render();
  }

  get data() {
    return this.#data;
  }

  #syncFromAttrs() {
    this.#data = {
      testId: this.getAttribute('test-id') || this.#data.testId,
      url: this.getAttribute('url') || this.#data.url,
      runTime: this.getAttribute('run-time') || this.#data.runTime,
      browser: this.getAttribute('browser') || this.#data.browser,
      screenshotUrl:
        this.getAttribute('screenshot-url') || this.#data.screenshotUrl,
    };
    this.#render();
  }

  #render() {
    const urlEl = this.#root.querySelector('#url');
    const browserEl = this.#root.querySelector('#browser');
    const runtimeEl = this.#root.querySelector('#runtime');
    const testIdEl = this.#root.querySelector('#testid');
    const shot = this.#root.querySelector('#shot');

    if (urlEl) urlEl.textContent = this.#data.url || '(no url)';
    if (browserEl) browserEl.textContent = `Browser: ${this.#data.browser || '—'}`;
    if (runtimeEl)
      runtimeEl.textContent = `Run: ${this.#data.runTime || '—'}`;
    if (testIdEl) testIdEl.textContent = this.#data.testId || '—';

    if (!shot) return;
    shot.innerHTML = '';
    if (this.#data.screenshotUrl) {
      const img = document.createElement('img');
      img.alt = `Screenshot for ${this.#data.testId}`;
      img.src = this.#data.screenshotUrl;
      shot.appendChild(img);
    } else {
      const div = document.createElement('div');
      div.className = 'fallback';
      div.textContent = 'No screenshot';
      shot.appendChild(div);
    }
  }
}

customElements.define('test-result', TestResult);


