import type { APIContext, APIRoute } from 'astro';
import type { Unzipped } from 'fflate';
import type { TestConfig } from '@/lib/types/tests';

import path from 'node:path';
import { unzipSync } from 'fflate';
import { z } from 'zod';
import { normalizeAndFilterZipFiles, toPosixPath } from '@/lib/utils/security';
import { generateTestId } from '@/lib/utils/testId';

import { TestSource, ContentRating } from '@/lib/types/tests';

// route is server-rendered by default b/c `astro.config.mjs` has `output: server`

// Extract file list from ZIP archive
async function getUnzipped(buffer: ArrayBuffer): Promise<Unzipped> {
  const uint8Array = new Uint8Array(buffer);
  const unzipped = unzipSync(uint8Array, {
    filter: file => {
      if (file.name.endsWith('/')) return false;
      return true;
    },
  });
  return unzipped;
}

// Generate a SHA-256 hash of the buffer contents to use as unique identifier (cloudflare mode only)
async function generateContentHash(buffer: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

export const POST: APIRoute = async (context: APIContext) => {
  try {
    // Validate formData
    const uploadSchema = z.object({
      file: z.instanceof(File),
      name: z.string().optional(),
      description: z.string().optional(),
      source: z.enum(TestSource),
    });
    const formData = await context.request.formData();
    const result = uploadSchema.safeParse({
      file: formData.get('file'),
      name: formData.get('name') || undefined,
      description: formData.get('description') || undefined,
      source: formData.get('source'),
    });
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error.issues }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const { file, name, description, source } = result.data;
    const mode = context.locals.mode;
    const storage = context.locals.storage;
    const testStore = context.locals.testStore;

    // Read file buffer
    const buffer = await file.arrayBuffer();
    const unzipped = await getUnzipped(buffer);
    const files = Object.keys(unzipped);

    // Cloudflare mode: dedup by SHA-256 of full ZIP contents.
    // Local mode: defer dedup until we know the testId (folder name).
    let zipKey = '';
    if (mode === 'cloudflare') {
      zipKey = await generateContentHash(buffer);
      const existing = await testStore.findByZipKey(zipKey);
      if (existing) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Duplicate uploads are not allowed.`,
            testId: existing.testId,
            contentRating: existing.contentRating,
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Locate config.json inside the archive
    const configPath = files.find(
      file => path.posix.basename(toPosixPath(file)) === 'config.json',
    );
    if (!configPath) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No config.json file found in the ZIP archive',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Strip the directory prefix from all files and filter to only valid, secure files
    const normalizedConfigPath = toPosixPath(configPath);
    const dirName = path.posix.dirname(normalizedConfigPath);
    const prefixToStrip = dirName === '.' ? '' : dirName + '/';
    // Parse filepaths and filter files in one function
    // IMPORTANT: silently drops all files not in expected list (such as index.html)
    const normalizedUnzipped = normalizeAndFilterZipFiles(
      unzipped,
      prefixToStrip,
    );
    const validFiles = Object.keys(normalizedUnzipped);
    // Ensure at least one valid file remains
    if (validFiles.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No valid Telescope output files found in ZIP after filtering',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Extract config.json
    const configBytes = normalizedUnzipped['config.json'];
    if (!configBytes) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to extract config.json from ZIP',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Parse config.json
    const configDecoder = new TextDecoder('utf-8', { fatal: true });
    let configText;
    try {
      configText = configDecoder.decode(configBytes);
    } catch (_error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to decode UTF-8 config.json bytes',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const configSchema = z.object({
      url: z.string().refine(
        url => {
          try {
            const parsed = new URL(url);
            return parsed.protocol === 'http:' || parsed.protocol === 'https:';
          } catch {
            return false;
          }
        },
        {
          message: 'URL must be a valid HTTP or HTTPS URL',
        },
      ),
      date: z.string(),
      options: z
        .object({
          url: z.string(),
        })
        .passthrough(),
      browserConfig: z
        .object({
          engine: z.string(),
        })
        .passthrough(),
    });
    type UploadConfigJson = z.infer<typeof configSchema>;
    let config: UploadConfigJson;
    try {
      const parsed = JSON.parse(configText);
      const configResult = configSchema.safeParse(parsed);
      if (!configResult.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid config.json: ${configResult.error.issues.map(i => i.message).join(', ')}`,
          }),
          { status: 400, headers: { 'Content-Type': 'application/json' } },
        );
      }
      config = configResult.data;
    } catch (_error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid JSON format in config.json',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Build test configuration object
    const testId = generateTestId(config.date);
    const browser =
      (config.options.browser as string | undefined) ||
      config.browserConfig.engine ||
      'unknown';
    const testConfig: TestConfig = {
      testId,
      zipKey,
      name,
      description,
      source,
      url: config.url,
      testDate: Math.floor(new Date(config.date).getTime() / 1000),
      browser,
    };

    // Local mode: dedup by folder name
    if (mode === 'local') {
      const existing = await testStore.findByTestId(testId);
      if (existing) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Duplicate uploads are not allowed.`,
            testId: existing.testId,
            contentRating: existing.contentRating,
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    }

    // Inject name/description into config.json before persisting it.
    if (name || description) {
      const enriched = {
        ...(config as unknown as Record<string, unknown>),
        ...(name ? { name } : {}),
        ...(description ? { description } : {}),
      };
      normalizedUnzipped['config.json'] = new TextEncoder().encode(
        JSON.stringify(enriched),
      );
    }

    // Persist test metadata (cloudflare: D1 row; local: no-op)
    try {
      await testStore.create(testConfig);
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to insert test: ${(error as Error).message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Persist all valid files via the storage layer
    for (const filename of Object.keys(normalizedUnzipped)) {
      await storage.put(testId, filename, normalizedUnzipped[filename]);
    }
    // Build success response first
    const response = new Response(
      JSON.stringify({
        success: true,
        testId,
        message: 'Upload processed successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    // AI rating: cloudflare mode only.
    if (mode === 'cloudflare') {
      const { env } = await import('cloudflare:workers');
      if (env.ENABLE_AI_RATING === 'true' && env.AI) {
        const cfRuntime = (
          context.locals as unknown as {
            runtime?: { ctx?: { waitUntil?: (p: Promise<unknown>) => void } };
          }
        ).runtime;
        const waitUntil = cfRuntime?.ctx?.waitUntil?.bind(cfRuntime.ctx);
        const job = (async () => {
          const { rateUrlContent } = await import('@/lib/ai/ai-content-rater');
          await testStore.updateContentRating(
            testId,
            ContentRating.IN_PROGRESS,
          );
          const rating = await rateUrlContent(
            env.AI!,
            testConfig.url,
            normalizedUnzipped['metrics.json'],
            normalizedUnzipped['screenshot.png'],
          );
          await testStore.updateContentRating(testId, rating);
        })();
        if (waitUntil) {
          waitUntil(job);
        } else {
          // Fallback: fire and forget without backgrounding.
          job.catch(err => console.error('[upload] rating job failed:', err));
        }
      }
    }

    return response;
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: (error as Error).message,
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
};
