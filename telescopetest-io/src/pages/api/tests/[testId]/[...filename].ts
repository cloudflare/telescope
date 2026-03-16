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
  // Validate testId format: YYYY_MM_DD_HH_MM_SS_UUID
  const testIdPattern =
    /^\d{4}_\d{2}_\d{2}_\d{2}_\d{2}_\d{2}_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
  if (!testIdPattern.test(testId)) {
    return new Response('Invalid testId format', { status: 400 });
  }
  // Validate filename: no path separators or traversal attempts
  const pathTraversalPattern = /(\.\.|\/|\\|%2e|%2f|%5c)/i;
  if (pathTraversalPattern.test(filename)) {
    return new Response('Invalid filename: path traversal not allowed', {
      status: 400,
    });
  }
  // Ensure filename has valid extension from allowlist
  const ext = filename.toLowerCase().split('.').pop();
  const allowedExtensions = [
    'json',
    'png',
    'jpg',
    'jpeg',
    'webp',
    'webm',
    'gif',
    'har',
    'txt',
  ];
  if (!ext || !allowedExtensions.includes(ext)) {
    return new Response('Invalid file extension', { status: 400 });
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
    // Determine content type based on file extension
    const ext = filename.toLowerCase().split('.').pop();
    const contentTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      webm: 'video/webm',
      json: 'application/json',
      har: 'application/json',
      txt: 'text/plain',
      webm: 'video/webm',
    };
    const contentType = contentTypeMap[ext || ''] || 'application/octet-stream'; // downloaded default
    // Security headers to prevent XSS execution
    const headers: Record<string, string> = {
      'Content-Type': contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff', // can't execute as code
      'Content-Security-Policy':
        "default-src 'none'; style-src 'unsafe-inline'; sandbox", // allows inline css only, other files in sandbox
    };
    // For non-media files, force download to prevent inline rendering
    // Allow images and videos to render inline
    if (!['png', 'jpg', 'jpeg', 'gif', 'webp', 'webm'].includes(ext || '')) {
      headers['Content-Disposition'] = `attachment; filename="${filename}"`;
    }
    return new Response(object.body, { headers });
  } catch (error) {
    console.error('R2 fetch error:', error);
    return new Response('Internal server error', { status: 500 });
  }
};
