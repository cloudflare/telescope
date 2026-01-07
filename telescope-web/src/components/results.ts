class ResultsList extends HTMLElement {
  private resultsDir: string = '/results';

  connectedCallback() {
    this.loadResults();
  }

  private async loadResults() {
    try {
      // Fetch the list of result directories
      const response = await fetch('/api/results');
      if (!response.ok) {
        throw new Error('Failed to fetch results');
      }
      const resultDirs = await response.json();

      // Load config for each result
      const results = await Promise.all(
        resultDirs.map(async (dir: string) => {
          try {
            const configResponse = await fetch(`/api/results/${dir}/config.json`);
            if (!configResponse.ok) {
              return null;
            }
            const config = await configResponse.json();
            return {
              testId: dir,
              url: config.url || 'Unknown URL',
              date: config.date || '',
              browser: config.options?.browser || 'unknown',
              screenshot: `/api/results/${dir}/screenshot.png`,
            };
          } catch (error) {
            console.error(`Error loading config for ${dir}:`, error);
            return null;
          }
        })
      );

      // Filter out null results and sort by date (newest first)
      const validResults = results
        .filter((r) => r !== null)
        .sort((a, b) => {
          const dateA = new Date(a.date).getTime();
          const dateB = new Date(b.date).getTime();
          return dateB - dateA;
        });

      this.render(validResults);
    } catch (error) {
      console.error('Error loading results:', error);
      this.renderError();
    }
  }

  private render(results: Array<{
    testId: string;
    url: string;
    date: string;
    browser: string;
    screenshot: string;
  }>) {
    this.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .results-container {
          display: flex;
          flex-direction: column;
          gap: 12px;
          margin-top: 24px;
        }

        .results-empty {
          padding: 32px;
          text-align: center;
          color: rgba(255, 255, 255, 0.62);
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          border: 1px solid rgba(255, 255, 255, 0.12);
        }

        .results-error {
          padding: 32px;
          text-align: center;
          color: rgba(255, 100, 100, 0.92);
          background: rgba(255, 0, 0, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(255, 100, 100, 0.3);
        }
      </style>
      <div class="results-container">
        ${results.length === 0
          ? '<div class="results-empty">No test results found.</div>'
          : results
              .map(
                (result) => `
          <result-item
            test-id="${result.testId}"
            url="${this.escapeHtml(result.url)}"
            date="${this.escapeHtml(result.date)}"
            browser="${this.escapeHtml(result.browser)}"
            screenshot="${this.escapeHtml(result.screenshot)}"
          ></result-item>
        `
              )
              .join('')}
      </div>
    `;
  }

  private renderError() {
    this.innerHTML = `
      <style>
        .results-error {
          padding: 32px;
          text-align: center;
          color: rgba(255, 100, 100, 0.92);
          background: rgba(255, 0, 0, 0.1);
          border-radius: 8px;
          border: 1px solid rgba(255, 100, 100, 0.3);
          margin-top: 24px;
        }
      </style>
      <div class="results-error">
        Failed to load test results. Please check the API endpoint.
      </div>
    `;
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

customElements.define('results-list', ResultsList);

