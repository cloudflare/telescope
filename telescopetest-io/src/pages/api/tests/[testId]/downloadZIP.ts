import { env } from 'cloudflare:workers';
import { zipSync } from 'fflate';

import type { APIContext, APIRoute } from 'astro';
import { ContentRating } from '@/lib/types/tests';
import { checkTestRating } from '@/lib/utils/contentRatingCache';

export const GET: APIRoute = async (context: APIContext) => {
  const { testId } = context.params;
  if (!testId) {
    return new Response('Missing testId', { status: 400 });
  }
  const aiEnabled = env.ENABLE_AI_RATING === 'true';
  if (aiEnabled) {
    const rating = await checkTestRating(context, testId);
    if (rating !== ContentRating.SAFE) {
      return new Response('Test file not available', { status: 404 });
    }
  }
  const bucket = env.RESULTS_BUCKET;
  const prefix = `${testId}/`;
  try {
    // Use R2 list() function that matches the prefix: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#r2listoptions
    const listed = await bucket.list({ prefix });
    if (!listed.objects || listed.objects.length === 0) {
      return new Response('No files found for this test', { status: 404 });
    }
    const keys = listed.objects
      .map(obj => obj.key)
      .filter(key => key.slice(prefix.length)); // filter out empty paths upfront
    const files: Record<string, Uint8Array> = {};
    // need for-loop for sequential downloads, doing parallel downloads could overwhelm Worker
    for (const key of keys) {
      const relativePath = key.slice(prefix.length);
      const r2obj = await bucket.get(key);
      if (r2obj) {
        const arrayBuffer = await r2obj.arrayBuffer();
        files[relativePath] = new Uint8Array(arrayBuffer);
      }
    }
    const zipped = zipSync(files, {
      level: 6, // default compression size/quality tradeoff: https://github.com/101arrowz/fflate#usage
    });
    const zipBuffer = zipped.buffer.slice(
      zipped.byteOffset,
      zipped.byteOffset + zipped.byteLength,
    ) as ArrayBuffer;
    return new Response(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${testId}.zip"`,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error(
      `[Download] ZIP generation error for testId: ${testId}`,
      error,
    );
    return new Response('Internal server error', { status: 500 });
  }
};
