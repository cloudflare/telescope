import { env } from 'cloudflare:workers';
import type { APIContext } from 'astro';
import { getPrismaClient } from '@/lib/prisma/client';
import { getTestRating } from '@/lib/repositories/testRepository';
import { ContentRating } from '@/lib/types/tests';

export function isAiEnabled(): boolean {
  return env.ENABLE_AI_RATING === 'true';
}

export function canTriggerWorkflow(): boolean {
  return isAiEnabled() && !!env.AI_RATING_WORKFLOW;
}

// true only when both the public bucket binding and CDN URL are configured
export function hasPublicBucket(): boolean {
  return !!env.PUBLIC_ASSETS_URL && !!env.PUBLIC_RESULTS_BUCKET;
}

// returns the CDN base URL if this test's files exist in the public bucket, empty string otherwise
// uses config.json as check — it's always present
export async function resolveAssetBase(testId: string): Promise<string> {
  if (!hasPublicBucket()) return '';
  const obj = await env.PUBLIC_RESULTS_BUCKET!.head(`${testId}/config.json`);
  return obj ? env.PUBLIC_ASSETS_URL! : '';
}

// checks content rating for a test, with immutable cache for final ratings (SAFE/UNSAFE)
export async function checkTestRating(
  context: APIContext,
  testId: string,
): Promise<string> {
  const cacheKey = `https://rating/${testId}`;
  const cache = await caches.open('rating-cache');
  try {
    const cached = await cache.match(cacheKey);
    if (cached) {
      return await cached.text();
    }
  } catch (error) {
    console.warn(`[Cache] Cache read error (ignoring):`, error);
  }
  const prisma = getPrismaClient(context);
  const test = await getTestRating(prisma, testId);
  if (!test) {
    return ContentRating.UNKNOWN;
  }
  const isFinalRating =
    test.rating === ContentRating.SAFE || test.rating === ContentRating.UNSAFE;
  if (isFinalRating) {
    try {
      await cache.put(
        cacheKey,
        new Response(test.rating, {
          headers: { 'Cache-Control': 'public, max-age=31536000, immutable' },
        }),
      );
    } catch (error) {
      console.warn(`[Cache] Cache write error (ignoring):`, error);
    }
  }
  return test.rating;
}
