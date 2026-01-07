class ResultItem extends HTMLElement {
  private _testId: string = '';
  private _url: string = '';
  private _date: string = '';
  private _browser: string = '';
  private _screenshotPath: string = '';

  static get observedAttributes() {
    return ['test-id', 'url', 'date', 'browser', 'screenshot'];
  }

  get testId(): string {
    return this._testId;
  }

  get url(): string {
    return this._url;
  }

  get date(): string {
    return this._date;
  }

  get browser(): string {
    return this._browser;
  }

  get screenshotPath(): string {
    return this._screenshotPath;
  }

  attributeChangedCallback(name: string, oldValue: string, newValue: string) {
    if (oldValue !== newValue) {
      if (name === 'test-id') {
        this._testId = newValue || '';
      } else if (name === 'url') {
        this._url = newValue || '';
      } else if (name === 'date') {
        this._date = newValue || '';
      } else if (name === 'browser') {
        this._browser = newValue || '';
      } else if (name === 'screenshot') {
        this._screenshotPath = newValue || '';
      }
      this.render();
    }
  }

  connectedCallback() {
    this.render();
    this.setupClickHandler();
  }

  private setupClickHandler() {
    this.addEventListener('click', () => {
      if (this.testId) {
        window.location.href = `/data/overview/${this.testId}`;
      }
    });
  }

  private formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toLocaleString();
    } catch {
      return dateString;
    }
  }

  private formatBrowser(browser: string): string {
    const browserMap: Record<string, string> = {
      chrome: 'Chrome',
      'chrome-beta': 'Chrome Beta',
      canary: 'Chrome Canary',
      edge: 'Microsoft Edge',
      safari: 'Safari',
      firefox: 'Firefox',
    };
    return browserMap[browser] || browser;
  }

  private render() {
    this.innerHTML = `
      <style>
        :host {
          display: block;
          padding: 16px;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        :host(:hover) {
          background: rgba(255, 255, 255, 0.08);
          border-color: rgba(125, 211, 252, 0.35);
          transform: translateY(-2px);
        }

        .result-content {
          display: flex;
          align-items: center;
          gap: 16px;
        }

        .result-info {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .result-url {
          font-size: 16px;
          font-weight: 600;
          color: rgba(255, 255, 255, 0.92);
          word-break: break-all;
        }

        .result-meta {
          display: flex;
          gap: 16px;
          font-size: 14px;
          color: rgba(255, 255, 255, 0.72);
        }

        .result-meta-item {
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .result-screenshot {
          width: 120px;
          height: 80px;
          object-fit: cover;
          border-radius: 6px;
          border: 1px solid rgba(255, 255, 255, 0.12);
          background: rgba(0, 0, 0, 0.2);
        }

        .result-screenshot:not([src]) {
          display: none;
        }
      </style>
      <div class="result-content">
        <div class="result-info">
          <div class="result-url">${this.url || 'Unknown URL'}</div>
          <div class="result-meta">
            <div class="result-meta-item">
              <span>🕐</span>
              <span>${this.formatDate(this.date)}</span>
            </div>
            <div class="result-meta-item">
              <span>🌐</span>
              <span>${this.formatBrowser(this.browser)}</span>
            </div>
          </div>
        </div>
        <img class="result-screenshot" src="${this.screenshotPath}" alt="Screenshot" />
      </div>
    `;
  }
}

customElements.define('result-item', ResultItem);

