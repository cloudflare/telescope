import { env } from 'cloudflare:workers';
import { isAiEnabled } from '@/lib/utils/assetAccess';
import { zipSync } from 'fflate';

import type { APIContext, APIRoute } from 'astro';
import { ContentRating } from '@/lib/types/tests';
import { checkTestRating } from '@/lib/utils/assetAccess';
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
  if (isAiEnabled()) {
    const rating = await checkTestRating(context, testId);
    if (rating !== ContentRating.SAFE) {
      return new Response('Test file not available', { status: 404 });
    }
  }
  const bucket = env.RESULTS_BUCKET;
  const prefix = `${testId}/`;
  try {
    // Paginate R2 list() — returns at most 1000 objects per call
    // https://developers.cloudflare.com/r2/api/workers/workers-api-reference/#r2listoptions
    let listed = await bucket.list({ prefix });
    const allObjects = [...listed.objects];
    while (listed.truncated) {
      listed = await bucket.list({ prefix, cursor: listed.cursor });
      allObjects.push(...listed.objects);
    }
    if (allObjects.length === 0) {
      return new Response('No files found for this test', { status: 404 });
    }
    const keys = allObjects
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
