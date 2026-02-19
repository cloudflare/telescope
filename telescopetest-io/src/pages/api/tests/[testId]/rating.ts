import type { APIContext, APIRoute } from 'astro';
import { createPrismaClient } from '@/lib/prisma/client';
import { getTestRating } from '@/lib/repositories/test-repository';

/**
 * GET /api/tests/:testId/rating
 * Returns the current content_rating for a test.
 * Used by the upload page to poll until AI rating resolves from 'unknown'.
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
  const rating = await getTestRating(prisma, testId);

  if (rating === null) {
    return new Response(JSON.stringify({ error: 'Test not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return new Response(JSON.stringify({ rating }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
