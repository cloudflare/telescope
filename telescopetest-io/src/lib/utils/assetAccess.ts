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

function hasPublicBucket(): boolean {
  return (
    isAiEnabled() && !!env.PUBLIC_ASSETS_URL && !!env.PUBLIC_RESULTS_BUCKET
  );
}

function publicCdnUrl(key: string): string {
  return `${env.PUBLIC_ASSETS_URL}/${key}`;
}

/**
 * Check test rating with cache
 * Cache key format: https://rating/{testId}
 * TTL: immutable (ratings never change once final)
 * Only caches final ratings (SAFE or UNSAFE), not UNKNOWN or IN_PROGRESS
 */
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

/**
 * Returns the public CDN URL for a given R2 key if the file has been copied
 * to the public bucket, or null if not (e.g. test predates workflow deployment).
 *
 * Use in API endpoints to redirect to CDN instead of serving through the Worker.
 */
export async function resolvePublicUrl(key: string): Promise<string | null> {
  if (!hasPublicBucket()) return null;
  const obj = await env.PUBLIC_RESULTS_BUCKET!.head(key);
  return obj ? publicCdnUrl(key) : null;
}

/**
 * Returns the public CDN base URL if a test's files are in the public bucket,
 * or empty string if not. Uses the screenshot as a proxy for migration status.
 *
 * Use in page frontmatter to build all asset URLs for a results page.
 */
export async function resolveAssetBase(testId: string): Promise<string> {
  if (!hasPublicBucket()) return '';
  const obj = await env.PUBLIC_RESULTS_BUCKET!.head(`${testId}/screenshot.png`);
  return obj ? env.PUBLIC_ASSETS_URL! : '';
}
