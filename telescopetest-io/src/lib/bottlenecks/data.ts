import type { Har } from '@/lib/types/har';
import type { ResourceTiming } from '@/lib/types/resources';
import type { MetricsJson } from '@/lib/types/metrics';

// client-side fetching for getting data for pie charts
export async function loadBottlenecksData(testId: string): Promise<{
  har: Har | null;
  resources: ResourceTiming[];
  metrics: MetricsJson | null;
}> {
  try {
    const [harRes, resourcesRes, metricsRes] = await Promise.all([
      fetch(`/api/tests/${testId}/pageload.har`),
      fetch(`/api/tests/${testId}/resources.json`),
      fetch(`/api/tests/${testId}/metrics.json`),
    ]);
    const har: Har | null = harRes.ok ? await harRes.json() : null;
    const resources: ResourceTiming[] = resourcesRes.ok
      ? await resourcesRes.json()
      : [];
    const metrics: MetricsJson | null = metricsRes.ok
      ? await metricsRes.json()
      : null;
    return { har, resources, metrics };
  } catch (err) {
    console.error('Failed to load data:', err);
    return { har: null, resources: [], metrics: null };
  }
}
