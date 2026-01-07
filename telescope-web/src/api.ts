export type ResultSummary = {
  testId: string;
  url: string;
  runTime: string;
  browser: string;
  screenshotUrl: string | null;
};

export async function apiGet<T>(path: string): Promise<T> {
  const res = await fetch(path, { headers: { accept: 'application/json' } });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Request failed (${res.status}): ${text || path}`);
  }
  return (await res.json()) as T;
}

export async function getReadme() {
  return await apiGet<{ markdown: string }>('/api/readme');
}

export async function getBrowsers() {
  return await apiGet<{ browsers: string[] }>('/api/browsers');
}

export async function getDefaultOptions() {
  return await apiGet<{ defaults: Record<string, unknown> }>('/api/options');
}

export async function getResults() {
  return await apiGet<{ results: ResultSummary[] }>('/api/results');
}

export async function getResultConfig(testId: string) {
  return await apiGet<any>(`/api/results/${encodeURIComponent(testId)}/config`);
}

export async function getResultMetrics(testId: string) {
  return await apiGet<any>(`/api/results/${encodeURIComponent(testId)}/metrics`);
}

export async function getResultConsole(testId: string) {
  return await apiGet<any[]>(`/api/results/${encodeURIComponent(testId)}/console`);
}

export async function getResultResources(testId: string) {
  return await apiGet<any>(`/api/results/${encodeURIComponent(testId)}/resources`);
}

export async function getResultHar(testId: string) {
  return await apiGet<any>(`/api/results/${encodeURIComponent(testId)}/har`);
}

export async function getResultFilmstrip(testId: string) {
  return await apiGet<{ images: Array<{ name: string; url: string }> }>(
    `/api/results/${encodeURIComponent(testId)}/filmstrip`,
  );
}

export async function getResultVideoInfo(testId: string) {
  return await apiGet<{ filename: string; url: string }>(
    `/api/results/${encodeURIComponent(testId)}/video/info`,
  );
}


