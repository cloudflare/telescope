import type { APIContext, APIRoute } from 'astro';
import { ContentRating } from '@/lib/types/tests';

/**
 * GET /api/tests/:testId/rating
 *
 * Returns the current content_rating for a test.
 *
 * In local mode AI rating is disabled and all tests are reported safe.
 * In cloudflare mode this proxies the testStore for the live rating.
 */
export const GET: APIRoute = async (context: APIContext) => {
  const { testId } = context.params;
  if (!testId) {
    return new Response(JSON.stringify({ error: 'Missing testId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Local mode: rating is always SAFE if the test exists.
  if (context.locals.mode === 'local') {
    const test = await context.locals.testStore.findByTestId(testId);
    if (!test) {
      return new Response(JSON.stringify({ error: 'Test not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    return new Response(JSON.stringify({ rating: ContentRating.SAFE }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const test = await context.locals.testStore.getRating(testId);
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
