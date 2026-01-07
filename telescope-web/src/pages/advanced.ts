import { getBrowsers, getDefaultOptions } from '../api';

type Field =
  | { key: string; label: string; type: 'text' | 'number' | 'url' }
  | { key: string; label: string; type: 'boolean' }
  | { key: string; label: string; type: 'select'; options: string[] }
  | { key: string; label: string; type: 'json' }
  | { key: string; label: string; type: 'stringList' };

const CONNECTION_TYPES = [
  'cable',
  'dsl',
  '4g',
  '3g',
  '3gfast',
  '3gslow',
  '2g',
  'fios',
];

const ADVANCED_FIELDS: Field[] = [
  { key: 'url', label: 'URL', type: 'url' },
  { key: 'browser', label: 'Browser', type: 'select', options: [] }, // patched at runtime
  { key: 'width', label: 'Viewport width', type: 'number' },
  { key: 'height', label: 'Viewport height', type: 'number' },
  { key: 'frameRate', label: 'Filmstrip frame rate (fps)', type: 'number' },
  { key: 'timeout', label: 'Timeout (ms)', type: 'number' },
  { key: 'cpuThrottle', label: 'CPU throttle factor', type: 'number' },
  { key: 'connectionType', label: 'Connection type', type: 'select', options: ['false', ...CONNECTION_TYPES] },
  { key: 'headers', label: 'Headers (JSON)', type: 'json' },
  { key: 'cookies', label: 'Cookies (JSON)', type: 'json' },
  { key: 'flags', label: 'Chromium flags (comma separated)', type: 'text' },
  { key: 'blockDomains', label: 'Block domains (comma separated)', type: 'stringList' },
  { key: 'block', label: 'Block URL substrings (comma separated)', type: 'stringList' },
  { key: 'firefoxPrefs', label: 'Firefox prefs (JSON)', type: 'json' },
  { key: 'disableJS', label: 'Disable JavaScript', type: 'boolean' },
  { key: 'debug', label: 'Debug logging', type: 'boolean' },
  { key: 'html', label: 'Generate HTML report', type: 'boolean' },
  { key: 'openHtml', label: 'Open HTML report', type: 'boolean' },
  { key: 'list', label: 'Generate HTML list of results', type: 'boolean' },
  { key: 'zip', label: 'Zip results folder', type: 'boolean' },
  { key: 'auth', label: 'HTTP basic auth (JSON)', type: 'json' },
];

function toInputHtml(field: Field, value: unknown) {
  const name = field.key;
  const safeVal =
    value === undefined || value === null ? '' : String(value);

  if (field.type === 'boolean') {
    const checked = value === true ? 'checked' : '';
    return `
      <label style="display:flex; gap:10px; align-items:center; padding: 8px 0;">
        <input name="${name}" type="checkbox" ${checked} />
        <span style="color: rgba(255,255,255,0.78)">${field.label}</span>
      </label>
    `;
  }

  if (field.type === 'select') {
    const opts = field.options
      .map(o => {
        const selected = String(o) === safeVal ? 'selected' : '';
        return `<option value="${o}" ${selected}>${o}</option>`;
      })
      .join('');
    return `
      <label>
        ${field.label}
        <select name="${name}">${opts}</select>
      </label>
    `;
  }

  if (field.type === 'json') {
    const pretty =
      typeof value === 'string'
        ? value
        : value
          ? JSON.stringify(value, null, 2)
          : '';
    return `
      <label style="grid-column: 1 / -1;">
        ${field.label}
        <textarea name="${name}" spellcheck="false" placeholder="{}">${pretty}</textarea>
      </label>
    `;
  }

  if (field.type === 'stringList') {
    const list = Array.isArray(value) ? value.join(',') : safeVal;
    return `
      <label style="grid-column: 1 / -1;">
        ${field.label}
        <input name="${name}" type="text" value="${list}" />
      </label>
    `;
  }

  return `
    <label>
      ${field.label}
      <input name="${name}" type="${field.type}" value="${safeVal}" />
    </label>
  `;
}

function parseValue(field: Field, raw: FormDataEntryValue | null) {
  if (field.type === 'boolean') return raw === 'on';
  if (field.type === 'number') {
    const n = Number(raw ?? '');
    return Number.isFinite(n) ? n : undefined;
  }
  if (field.type === 'select') {
    if (field.key === 'connectionType') {
      const v = String(raw ?? 'false');
      return v === 'false' ? false : v;
    }
    return String(raw ?? '');
  }
  if (field.type === 'json') {
    const txt = String(raw ?? '').trim();
    if (!txt) return undefined;
    return JSON.parse(txt);
  }
  if (field.type === 'stringList') {
    const txt = String(raw ?? '').trim();
    if (!txt) return [];
    return txt
      .split(',')
      .map(s => s.trim())
      .filter(Boolean);
  }
  return String(raw ?? '');
}

export async function renderAdvanced(outlet: HTMLElement) {
  outlet.innerHTML = `
    <section class="panel pad">
      <h1 class="h1">Advanced</h1>
      <p class="sub">All options from README, with sensible defaults.</p>
      <form id="advForm" class="grid-2"></form>
      <div style="height:16px"></div>
      <pre id="preview" style="margin:0; display:none;"></pre>
    </section>
  `;

  const form = outlet.querySelector<HTMLFormElement>('#advForm');
  const preview = outlet.querySelector<HTMLPreElement>('#preview');
  if (!form || !preview) return;
  const previewEl = preview;

  let defaults: Record<string, unknown> = {};
  try {
    const d = await getDefaultOptions();
    defaults = d.defaults ?? {};
  } catch {
    defaults = {};
  }

  let browsers: string[] = [];
  try {
    const b = await getBrowsers();
    browsers = b.browsers ?? [];
  } catch {
    browsers = [];
  }

  const fields = ADVANCED_FIELDS.map(f => {
    if (f.type === 'select' && f.key === 'browser') {
      return { ...f, options: browsers.length ? browsers : ['chrome'] } as Field;
    }
    return f;
  });

  const savedRaw = localStorage.getItem('telescope.advanced');
  const saved = savedRaw ? (JSON.parse(savedRaw) as Record<string, unknown>) : {};

  form.innerHTML = `
    ${fields.map(f => toInputHtml(f, saved[f.key] ?? defaults[f.key])).join('')}
    <div style="grid-column: 1 / -1; display:flex; gap: 12px; align-items:center;">
      <button type="submit">Save</button>
      <button type="button" id="resetBtn">Reset</button>
      <span class="sub" style="margin:0" id="status"></span>
    </div>
  `;

  const status = outlet.querySelector<HTMLElement>('#status');
  const reset = outlet.querySelector<HTMLButtonElement>('#resetBtn');

  function updatePreview(obj: Record<string, unknown>) {
    previewEl.style.display = 'block';
    previewEl.textContent = JSON.stringify(obj, null, 2);
  }

  if (Object.keys(saved).length) updatePreview(saved);

  reset?.addEventListener('click', () => {
    localStorage.removeItem('telescope.advanced');
    window.location.reload();
  });

  form.addEventListener('submit', e => {
    e.preventDefault();
    const fd = new FormData(form);
    const out: Record<string, unknown> = {};
    try {
      for (const f of fields) {
        const raw = fd.get(f.key);
        const val = parseValue(f, raw);
        if (val !== undefined && val !== '') out[f.key] = val;
      }
    } catch (err: any) {
      if (status) status.textContent = `Invalid input: ${err?.message ?? err}`;
      return;
    }
    localStorage.setItem('telescope.advanced', JSON.stringify(out));
    updatePreview(out);
    if (status) status.textContent = 'Saved locally.';
  });
}


