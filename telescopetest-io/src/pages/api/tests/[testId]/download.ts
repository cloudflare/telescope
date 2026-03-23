import { env } from 'cloudflare:workers';

import type { APIContext, APIRoute } from 'astro';
import { getPrismaClient } from '@/lib/prisma/client';
import { getTestById } from '@/lib/repositories/testRepository';
import { ContentRating } from '@/lib/types/tests';

export const GET: APIRoute = async (context: APIContext) => {
  const { testId } = context.params;
  if (!testId) {
    return new Response('Missing testId', { status: 400 });
  }
  const aiEnabled = env.ENABLE_AI_RATING === 'true';
  const prisma = getPrismaClient(context);
  const test = await getTestById(prisma, testId);
  if (!test) {
    return new Response('Test not found', { status: 404 });
  }
  if (aiEnabled && test.content_rating !== ContentRating.SAFE) {
    return new Response('Test file not available', { status: 404 });
  }
  const bucket = env.RESULTS_BUCKET;
  const prefix = `${testId}/`;
  try {
    const listed = await bucket.list({ prefix });
    if (!listed.objects || listed.objects.length === 0) {
      return new Response('No files found for this test', { status: 404 });
    }
    const fflate = await import('fflate');
    const files: Record<string, Uint8Array> = {};
    for (const obj of listed.objects) {
      const key = obj.key;
      const relativePath = key.slice(prefix.length);
      if (!relativePath) continue;
      const r2obj = await bucket.get(key);
      if (r2obj) {
        const arrayBuffer = await r2obj.arrayBuffer();
        files[relativePath] = new Uint8Array(arrayBuffer);
      }
    }
    const zipped = fflate.zipSync(files, {
      level: 6,
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
    console.error('ZIP generation error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
