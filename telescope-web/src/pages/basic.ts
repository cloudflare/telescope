import { getBrowsers } from '../api';

export async function renderBasic(outlet: HTMLElement) {
  outlet.innerHTML = `
    <section class="panel pad">
      <h1 class="h1">Basic</h1>
      <p class="sub">Provide a URL and select a browser.</p>
      <form id="basicForm" class="grid-2">
        <label>
          URL
          <input name="url" type="url" placeholder="https://example.com" required />
        </label>
        <label>
          Browser
          <select name="browser" id="browserSelect" required></select>
        </label>
        <div style="grid-column: 1 / -1; display: flex; gap: 12px; align-items: center;">
          <button type="submit">Save</button>
          <span class="sub" style="margin:0" id="status"></span>
        </div>
      </form>
      <div style="height:16px"></div>
      <pre id="preview" style="margin:0; display:none;"></pre>
    </section>
  `;

  const sel = outlet.querySelector<HTMLSelectElement>('#browserSelect');
  const status = outlet.querySelector<HTMLElement>('#status');
  const form = outlet.querySelector<HTMLFormElement>('#basicForm');
  const preview = outlet.querySelector<HTMLPreElement>('#preview');
  if (!sel || !form || !preview) return;

  try {
    const { browsers } = await getBrowsers();
    sel.innerHTML = browsers
      .map(b => `<option value="${b}">${b}</option>`)
      .join('');
  } catch (e: any) {
    if (status) status.textContent = `Failed to load browsers: ${e?.message ?? e}`;
  }

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const url = String(fd.get('url') || '');
    const browser = String(fd.get('browser') || '');

    const payload = { url, browser };
    localStorage.setItem('telescope.basic', JSON.stringify(payload));

    preview.style.display = 'block';
    preview.textContent = JSON.stringify(payload, null, 2);
    if (status) status.textContent = 'Saved locally.';
  });

  // restore
  const saved = localStorage.getItem('telescope.basic');
  if (saved) {
    try {
      const obj = JSON.parse(saved) as { url?: string; browser?: string };
      const urlInput = form.querySelector<HTMLInputElement>('input[name="url"]');
      if (urlInput && obj.url) urlInput.value = obj.url;
      if (obj.browser) sel.value = obj.browser;
      preview.style.display = 'block';
      preview.textContent = JSON.stringify(obj, null, 2);
    } catch {
      // ignore
    }
  }
}


