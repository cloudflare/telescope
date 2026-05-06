import { zipSync } from 'fflate';

import type { APIContext, APIRoute } from 'astro';
import { ContentRating } from '@/lib/types/tests';
import { checkTestRating } from '@/lib/utils/contentRatingCache';
import { isValidTestId } from '@/lib/utils/security';

export const GET: APIRoute = async (context: APIContext) => {
  const { testId } = context.params;
  if (!testId) {
    return new Response('Missing testId', { status: 400 });
  }
  // Validate testId format: YYYY_MM_DD_HH_MM_SS_UUID
  if (!isValidTestId(testId)) {
    return new Response('Invalid testId format', { status: 400 });
  }

  // AI rating gating only applies in cloudflare mode.
  if (context.locals.mode === 'cloudflare') {
    const { env } = await import('cloudflare:workers');
    const aiEnabled = env.ENABLE_AI_RATING === 'true';
    if (aiEnabled) {
      const rating = await checkTestRating(context, testId);
      if (rating !== ContentRating.SAFE) {
        return new Response('Test file not available', { status: 404 });
      }
    }
  }

  const storage = context.locals.storage;

  try {
    const keys = await storage.list(testId);
    if (keys.length === 0) {
      return new Response('No files found for this test', { status: 404 });
    }
    const files: Record<string, Uint8Array> = {};
    // Sequential reads to avoid overwhelming the runtime (esp. Workers).
    for (const key of keys) {
      const bytes = await storage.get(testId, key);
      if (bytes) {
        files[key] = bytes;
      }
    }
    const zipped = zipSync(files, {
      level: 6, // default compression size/quality tradeoff
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
