import { getResults } from '../api';

export async function renderResults(outlet: HTMLElement) {
  outlet.innerHTML = `
    <section class="panel pad">
      <h1 class="h1">Results</h1>
      <p class="sub">Enumerated from the <code>results/</code> folder.</p>
      <div id="list" style="display:grid; gap: 12px;"></div>
    </section>
  `;

  const list = outlet.querySelector<HTMLElement>('#list');
  if (!list) return;

  try {
    const { results } = await getResults();
    if (!results.length) {
      list.innerHTML = `<p class="sub" style="margin:0">No results found.</p>`;
      return;
    }

    results.forEach(r => {
      const el = document.createElement('test-result') as any;
      el.data = r;
      list.appendChild(el);
    });
  } catch (e: any) {
    list.innerHTML = `<p class="sub" style="margin:0">Failed to load results: ${e?.message ?? e}</p>`;
  }
}


