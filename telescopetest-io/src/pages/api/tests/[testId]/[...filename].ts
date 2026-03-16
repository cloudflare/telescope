import type { APIContext, APIRoute } from 'astro';
import { getPrismaClient } from '@/lib/prisma/client';
import { getTestRating } from '@/lib/repositories/testRepository';
import { ContentRating } from '@/lib/types/tests';
// route is server-rendered by default b/c `astro.config.mjs` has `output: server`

/**
 * Serve files from R2 bucket
 * Route: /api/tests/{testId}/{filename}
 * Supports nested paths like filmstrip/frame_1.jpg or video files
 * Used for serving screenshots and other test artifacts
 */
export const GET: APIRoute = async (context: APIContext) => {
  const { testId, filename } = context.params;
  if (!testId || !filename) {
    return new Response('Missing testId or filename', { status: 400 });
  }
  const env = context.locals.runtime.env;
  const aiEnabled = env.ENABLE_AI_RATING === 'true';
  if (aiEnabled) {
    const prisma = getPrismaClient(context);
    const test = await getTestRating(prisma, testId);
    if (!test || test.rating !== ContentRating.SAFE) {
      return new Response('Test file not available', { status: 404 });
    }
  }
  const key = `${testId}/${filename}`;
  try {
    const object = await env.RESULTS_BUCKET.get(key);
    if (!object) {
      return new Response('File not found', { status: 404 });
    }
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      svg: 'image/svg+xml',
      json: 'application/json',
      har: 'application/json',
      html: 'text/html',
      css: 'text/css',
      js: 'application/javascript',
      txt: 'text/plain',
      webm: 'video/webm',
      mp4: 'video/mp4',
    };
    const contentType = contentTypeMap[ext || ''] || 'application/octet-stream';
    return new Response(object.body, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('R2 fetch error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
