import type { Har } from '@/lib/types/har';
import type { ResourceTiming } from '@/lib/types/resources';

export async function loadBottlenecksData(
  testId: string,
): Promise<{ har: Har | null; resources: ResourceTiming[] }> {
  try {
    const [harRes, resourcesRes] = await Promise.all([
      fetch(`/api/tests/${testId}/pageload.har`),
      fetch(`/api/tests/${testId}/resources.json`),
    ]);
    const har: Har | null = harRes.ok ? await harRes.json() : null;
    const resources: ResourceTiming[] = resourcesRes.ok
      ? await resourcesRes.json()
      : [];
    return { har, resources };
  } catch (err) {
    console.error('Failed to load data:', err);
    return { har: null, resources: [] };
  }
}
