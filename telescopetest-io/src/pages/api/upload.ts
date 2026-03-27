import { env } from 'cloudflare:workers';

import type { APIContext, APIRoute } from 'astro';
import type { Unzipped } from 'fflate';
import type { TestConfig } from '@/lib/types/tests';

import path from 'node:path';
import { unzipSync } from 'fflate';
import { z } from 'zod';
import { normalizeAndFilterZipFiles, toPosixPath } from '@/lib/utils/security';
import { generateTestId } from '@/lib/utils/testId';

import { TestSource } from '@/lib/types/tests';
import { getPrismaClient } from '@/lib/prisma/client';
import {
  createTest,
  findTestIdByZipKey,
} from '@/lib/repositories/testRepository';

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

// Generate a SHA-256 hash of the buffer contents to use as unique identifier
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
      // safeParse() is explicit runtime type check: https://zod.dev/basics?id=handling-errors
      file: formData.get('file'),
      name: formData.get('name'),
      description: formData.get('description'),
      source: formData.get('source'),
    });
    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error.errors }), {
        // TODO: add custom error messaging
        status: 400,
      });
    }
    const { file, name, description, source } = result.data;
    // Read file buffer
    const buffer = await file.arrayBuffer();
    const unzipped = await getUnzipped(buffer);
    const files = Object.keys(unzipped);
    // Generate hash for unique R2 storage key
    const zipKey = await generateContentHash(buffer);
    // Check if this exact content already exists in D1
    const prisma = getPrismaClient(context);
    const existing = await findTestIdByZipKey(prisma, zipKey);
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
    // Find if some ' .../config.json' exists
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
    } catch (error) {
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
    type ConfigJson = z.infer<typeof configSchema>;
    let config: ConfigJson;
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
    } catch (error) {
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
      config.options.browser || config.browserConfig.engine || 'unknown';
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
    // Store test metadata in database
    try {
      await createTest(prisma, testConfig);
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to insert test: ${(error as Error).message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // store all valid files in R2 with {testId}/{filename} format
    for (const filename of validFiles) {
      await env.RESULTS_BUCKET!.put(
        `${testId}/${filename}`,
        normalizedUnzipped[filename],
      );
    }
    // Build success response first
    const response = new Response(
      JSON.stringify({
        success: true,
        testId: testId,
        message: 'Upload processed successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );

    // Trigger AI rating workflow — runs in background with no timeout limit
    if (env.ENABLE_AI_RATING === 'true' && env.AI_RATING_WORKFLOW) {
      await env.AI_RATING_WORKFLOW.create({
        params: { testId, url: config.url },
      });
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
