import type { APIContext, APIRoute } from 'astro';
import { getTestRating } from '@/lib/repositories/testRepository';
import { getRuntimeServices } from '@/lib/runtime/context';

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
  const { tests } = getRuntimeServices(context);
  const test = await getTestRating(tests, testId);
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
