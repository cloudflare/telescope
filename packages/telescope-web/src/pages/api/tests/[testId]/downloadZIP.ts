import { zipSync } from 'fflate';

import type { APIContext, APIRoute } from 'astro';
import { ContentRating } from '@/lib/types/tests';
import { checkTestRating } from '@/lib/utils/contentRatingCache';
import { isValidTestId } from '@/lib/utils/security';
import { getRuntimeServices } from '@/lib/runtime/context';

export const GET: APIRoute = async (context: APIContext) => {
  const { testId } = context.params;
  if (!testId) {
    return new Response('Missing testId', { status: 400 });
  }
  // Validate testId format: YYYY_MM_DD_HH_MM_SS_UUID
  if (!isValidTestId(testId)) {
    return new Response('Invalid testId format', { status: 400 });
  }
  const services = getRuntimeServices(context);
  const { aiEnabled } = services;
  if (aiEnabled) {
    const rating = await checkTestRating(context, testId);
    if (rating !== ContentRating.SAFE) {
      return new Response('Test file not available', { status: 404 });
    }
  }
  const prefix = `${testId}/`;
  try {
    const keys = await services.results.list(prefix);
    if (keys.length === 0) {
      return new Response('No files found for this test', { status: 404 });
    }
    const files: Record<string, Uint8Array> = {};
    // Sequential reads avoid excessive memory pressure for large archives.
    for (const key of keys) {
      const relativePath = key.slice(prefix.length);
      if (!relativePath) continue;
      const object = await services.results.get(key);
      if (object) {
        const arrayBuffer = await object.arrayBuffer();
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
