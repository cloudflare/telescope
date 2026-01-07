import { getResultConfig } from '../../api';
import { navigate } from '../../router';

export async function renderConfig(outlet: HTMLElement, testId: string) {
  outlet.innerHTML = `
    <data-menu test-id="${testId}" active="config"></data-menu>
    <section class="panel pad">
      <div>
        <h1 class="h1" style="margin-bottom: 4px;">Config</h1>
        <p class="sub" style="margin:0">Test: <code>${testId}</code></p>
      </div>
      <div id="content" style="margin-top: 24px;"></div>
    </section>
  `;

  const content = outlet.querySelector<HTMLElement>('#content');
  if (!content) return;

  try {
    const config = await getResultConfig(testId);

    content.innerHTML = `
      <div class="panel pad" style="background: rgba(255,255,255,0.04); margin-bottom: 24px;">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Actions</h3>
        <div style="display: flex; gap: 12px; flex-wrap: wrap;">
          <button id="download-btn" style="padding: 12px 24px; background: rgba(125,211,252,0.2); border: 1px solid rgba(125,211,252,0.3); border-radius: 8px; color: rgba(125,211,252,0.92); cursor: pointer; font-size: 14px; font-weight: 500;">
            Download ZIP
          </button>
          <button id="rerun-btn" style="padding: 12px 24px; background: rgba(125,211,252,0.2); border: 1px solid rgba(125,211,252,0.3); border-radius: 8px; color: rgba(125,211,252,0.92); cursor: pointer; font-size: 14px; font-weight: 500;">
            Rerun Test
          </button>
          <button id="edit-rerun-btn" style="padding: 12px 24px; background: rgba(125,211,252,0.2); border: 1px solid rgba(125,211,252,0.3); border-radius: 8px; color: rgba(125,211,252,0.92); cursor: pointer; font-size: 14px; font-weight: 500;">
            Edit & Rerun
          </button>
        </div>
        <p id="action-status" class="sub" style="margin: 16px 0 0; color: rgba(255,255,255,0.6);"></p>
      </div>

      <div class="panel pad" style="background: rgba(255,255,255,0.04);">
        <h3 style="margin:0 0 16px; letter-spacing:-0.01em;">Configuration</h3>
        <pre id="config-json" style="background: rgba(0,0,0,0.3); padding: 16px; border-radius: 8px; overflow-x: auto; font-size: 13px; line-height: 1.5;"></pre>
      </div>
    `;

    const configJson = content.querySelector<HTMLPreElement>('#config-json');
    if (configJson) {
      configJson.textContent = JSON.stringify(config, null, 2);
    }

    const downloadBtn = content.querySelector<HTMLButtonElement>('#download-btn');
    const rerunBtn = content.querySelector<HTMLButtonElement>('#rerun-btn');
    const editRerunBtn = content.querySelector<HTMLButtonElement>('#edit-rerun-btn');
    const statusEl = content.querySelector<HTMLElement>('#action-status');

    downloadBtn?.addEventListener('click', async () => {
      if (statusEl) statusEl.textContent = 'Preparing download...';
      try {
        const response = await fetch(`/api/results/${encodeURIComponent(testId)}/download`);
        if (!response.ok) {
          const error = await response.json().catch(() => ({ error: 'Download failed' }));
          throw new Error(error.error || 'Download failed');
        }
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${testId}.zip`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        if (statusEl) statusEl.textContent = 'Download started.';
      } catch (err: any) {
        if (statusEl) statusEl.textContent = `Download failed: ${err?.message ?? err}`;
      }
    });

    rerunBtn?.addEventListener('click', () => {
      if (statusEl) statusEl.textContent = 'Rerun functionality would execute the test with the same configuration.';
      // TODO: Implement actual rerun via API
    });

    editRerunBtn?.addEventListener('click', () => {
      // Navigate to advanced page with config pre-filled
      if (config?.options) {
        localStorage.setItem('telescope.advanced', JSON.stringify(config.options));
      }
      navigate('/advanced');
      if (statusEl) statusEl.textContent = 'Redirecting to Advanced page with configuration loaded...';
    });
  } catch (e: any) {
    content.innerHTML = `<p class="sub" style="margin:0">Failed to load config: ${e?.message ?? e}</p>`;
  }
}

