import type { APIContext, APIRoute } from 'astro';
import { createPrismaClient } from '@/lib/prisma/client';
import {
  getTestRating,
  updateContentRating,
} from '@/lib/repositories/test-repository';
import { rateUrlContent } from '@/lib/ai/ai-content-rater';
import { ContentRating } from '@/lib/classes/TestConfig';

/**
 * GET /api/tests/:testId/rating
 * Returns the current content_rating for a test.
 * If the rating is still unknown and AI is enabled, re-triggers rating via waitUntil.
 * This self-heals tests where the original waitUntil was interrupted (e.g. user refreshed).
 */
export const GET: APIRoute = async (context: APIContext) => {
  const { testId } = context.params;
  if (!testId) {
    return new Response(JSON.stringify({ error: 'Missing testId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const env = context.locals.runtime.env;
  const prisma = createPrismaClient(env.TELESCOPE_DB);
  const test = await getTestRating(prisma, testId);
  if (test === null) {
    return new Response(JSON.stringify({ error: 'Test not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  // If unknown and AI is enabled, mark as in-progress then re-trigger rating.
  // Marking as IN_PROGRESS immediately prevents concurrent polls from firing duplicate jobs.
  // The AI always resolves to safe or unsafe, so IN_PROGRESS is only ever transient.
  if (test.rating === 'unknown' && env.ENABLE_AI_RATING === 'true' && env.AI) {
    await updateContentRating(prisma, testId, ContentRating.IN_PROGRESS);
    context.locals.runtime.ctx.waitUntil(
      (async () => {
        const [metricsObj, screenshotObj] = await Promise.all([
          env.RESULTS_BUCKET.get(`${testId}/metrics.json`),
          env.RESULTS_BUCKET.get(`${testId}/screenshot.png`),
        ]);
        const [metricsBytes, screenshotBytes] = await Promise.all([
          metricsObj
            ? metricsObj.arrayBuffer().then(b => new Uint8Array(b))
            : Promise.resolve(undefined),
          screenshotObj
            ? screenshotObj.arrayBuffer().then(b => new Uint8Array(b))
            : Promise.resolve(undefined),
        ]);
        const rating = await rateUrlContent(
          env.AI!,
          test.url,
          metricsBytes,
          screenshotBytes,
        );
        await updateContentRating(prisma, testId, rating);
      })(),
    );
  }

  // test.rating is still 'unknown' in memory even though we just wrote 'in_progress' to the DB — return the updated value instead of the stale one
  const responseRating =
    test.rating === 'unknown' ? ContentRating.IN_PROGRESS : test.rating;
  return new Response(JSON.stringify({ rating: responseRating }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
