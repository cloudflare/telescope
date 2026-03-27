import { env } from 'cloudflare:workers';

import type { APIContext, APIRoute } from 'astro';
import { ContentRating } from '@/lib/types/tests';
import {
  isValidTestId,
  isExpectedTelescopeFile,
  toPosixPath,
} from '@/lib/utils/security';
import { checkTestRating } from '@/lib/utils/contentRatingCache';

/**
 * Serve files from R2 bucket
 * Route: /api/tests/{testId}/{filename}
 * Supports nested paths like filmstrip/frame_1.jpg or video files
 * Used for serving screenshots and other test artifacts
 */
export const GET: APIRoute = async (context: APIContext) => {
  const { testId, filename } = context.params;
  const normalizedFilename = filename ? toPosixPath(filename) : undefined;
  if (!testId || !normalizedFilename) {
    return new Response('Missing testId or filename', { status: 400 });
  }
  // Validate testId format: YYYY_MM_DD_HH_MM_SS_UUID
  if (!isValidTestId(testId)) {
    return new Response('Invalid testId format', { status: 400 });
  }
  // Ensure filename matches expected Telescope output files
  if (!isExpectedTelescopeFile(normalizedFilename)) {
    return new Response('Invalid file', { status: 400 });
  }
  const aiEnabled = env.ENABLE_AI_RATING === 'true';
  if (aiEnabled) {
    const rating = await checkTestRating(context, testId);
    if (rating !== ContentRating.SAFE) {
      return new Response('Test file not available', { status: 404 });
    }
  }
  const key = `${testId}/${normalizedFilename}`;
  try {
    const r2Start = Date.now();
    const object = await env.RESULTS_BUCKET.get(key);
    const r2Duration = Date.now() - r2Start;
    console.log(`[R2] Fetch took ${r2Duration}ms - key: ${key}`);
    if (!object) {
      console.warn(`[R2] File not found in bucket - key: ${key}`);
      return new Response('File not found', { status: 404 });
    }
    // Determine content type based on file extension
    const ext = normalizedFilename.toLowerCase().split('.').pop();
    const contentTypeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      webm: 'video/webm',
      json: 'application/json',
      har: 'application/json',
      txt: 'text/plain',
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
    // HAR files use testId.har as filename for better identification
    if (ext === 'har') {
      headers['Content-Disposition'] = `attachment; filename="${testId}.har"`;
    } else if (!['png', 'jpg', 'webm'].includes(ext || '')) {
      headers['Content-Disposition'] =
        `attachment; filename="${normalizedFilename}"`;
    }
    return new Response(object.body, { headers });
  } catch (error) {
    console.error(
      `[R2] Fetch error - key: ${key}, testId: ${testId}, file: ${normalizedFilename}`,
      error,
    );
    return new Response('Internal server error', { status: 500 });
  }
};
