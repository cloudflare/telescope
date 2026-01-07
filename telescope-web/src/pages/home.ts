import { marked } from 'marked';
import { getReadme } from '../api';

export async function renderHome(outlet: HTMLElement) {
  outlet.innerHTML = `
    <section class="panel pad">
      <h1 class="h1">Browser Agent</h1>
      <p class="sub">A diagnostic, cross-browser performance testing agent — UI powered by Web Components.</p>
      <div id="readme"></div>
    </section>
  `;

  const readmeEl = outlet.querySelector<HTMLElement>('#readme');
  if (!readmeEl) return;

  try {
    const { markdown } = await getReadme();
    const html = marked.parse(markdown) as string;
    readmeEl.innerHTML = `
      <div class="md">
        ${html}
      </div>
    `;
    const md = readmeEl.querySelector<HTMLElement>('.md');
    if (md) {
      const style = document.createElement('style');
      style.textContent = `
        .md h2 { margin: 28px 0 10px; font-size: 20px; letter-spacing: -0.01em; }
        .md h3 { margin: 22px 0 8px; font-size: 16px; letter-spacing: -0.01em; }
        .md p, .md li { color: rgba(255,255,255,0.78); }
        .md a { color: rgba(125,211,252,0.92); text-decoration: none; }
        .md a:hover { text-decoration: underline; }
        .md code { padding: 2px 6px; border-radius: 8px; background: rgba(0,0,0,0.25); border: 1px solid rgba(255,255,255,0.12); }
        .md pre code { padding: 0; border: 0; background: transparent; }
        .md pre { margin: 14px 0; }
        .md ul { padding-left: 18px; }
        .md strong { color: rgba(255,255,255,0.92); }
      `;
      readmeEl.prepend(style);
    }
  } catch (e: any) {
    readmeEl.innerHTML = `<p class="sub">Failed to load README: ${e?.message ?? e}</p>`;
  }
}


