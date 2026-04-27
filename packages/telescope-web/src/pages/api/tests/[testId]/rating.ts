import type { APIContext, APIRoute } from 'astro';
import { getPrismaClient } from '@/lib/prisma/client';
import { getTestRating } from '@/lib/repositories/testRepository';

/**
 * GET /api/tests/:testId/rating
 * Returns the current content_rating for a test.
 */
export const GET: APIRoute = async (context: APIContext) => {
  const { testId } = context.params;
  if (!testId) {
    return new Response(JSON.stringify({ error: 'Missing testId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  const prisma = getPrismaClient(context);
  const test = await getTestRating(prisma, testId);
  if (test === null) {
    return new Response(JSON.stringify({ error: 'Test not found' }), {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
  }
  return new Response(JSON.stringify({ rating: test.rating }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
};
