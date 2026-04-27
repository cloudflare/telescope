import type { APIContext } from 'astro';
import { getPrismaClient } from '@/lib/prisma/client';
import { getTestRating } from '@/lib/repositories/testRepository';
import { ContentRating } from '@/lib/types/tests';

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
