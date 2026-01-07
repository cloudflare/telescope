export async function renderUpload(outlet: HTMLElement) {
  outlet.innerHTML = `
    <section class="panel pad">
      <h1 class="h1">Upload</h1>
      <p class="sub">Upload a <code>.zip</code> file (stored locally under <code>uploads/</code>).</p>
      <form id="upForm" class="grid-2">
        <label style="grid-column: 1 / -1;">
          Zip file
          <input id="zip" name="zip" type="file" accept=".zip,application/zip" required />
        </label>
        <div style="grid-column: 1 / -1; display:flex; gap: 12px; align-items:center;">
          <button type="submit">Upload</button>
          <span class="sub" style="margin:0" id="status"></span>
        </div>
      </form>
      <div style="height:16px"></div>
      <pre id="resp" style="margin:0; display:none;"></pre>
    </section>
  `;

  const form = outlet.querySelector<HTMLFormElement>('#upForm');
  const input = outlet.querySelector<HTMLInputElement>('#zip');
  const status = outlet.querySelector<HTMLElement>('#status');
  const resp = outlet.querySelector<HTMLPreElement>('#resp');
  if (!form || !input || !resp) return;

  form.addEventListener('submit', async e => {
    e.preventDefault();
    const file = input.files?.[0];
    if (!file) return;

    status && (status.textContent = 'Uploading…');
    resp.style.display = 'none';

    const fd = new FormData();
    fd.append('file', file, file.name);

    try {
      const r = await fetch('/api/upload', { method: 'POST', body: fd });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(JSON.stringify(j));
      resp.style.display = 'block';
      resp.textContent = JSON.stringify(j, null, 2);
      status && (status.textContent = 'Uploaded.');
      form.reset();
    } catch (err: any) {
      status && (status.textContent = `Upload failed: ${err?.message ?? err}`);
    }
  });
}


