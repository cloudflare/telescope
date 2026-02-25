import type { APIContext, APIRoute } from 'astro';
import type { Unzipped } from 'fflate';
import type { ConfigJson, TestConfig } from '@/lib/classes/TestConfig';

import { unzipSync } from 'fflate';
import { z } from 'zod';

import { generateTestId, TestSource } from '@/lib/classes/TestConfig';
import { getPrismaClient } from '@/lib/prisma/client';
import {
  createTest,
  findTestIdByZipKey,
} from '@/lib/repositories/test-repository';

// route is server-rendered by default b/c `astro.config.mjs` has `output: server`

/**
 * Extract file list from ZIP archive
 * Works in both Node.js (adm-zip) and Cloudflare Workers (fflate) environments
 * @param buffer - ArrayBuffer containing ZIP file data
 * @returns Promise<Unzipped> - Unzipped type return
 */
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

/**
 * Generate a SHA-256 hash of the buffer contents to use as unique identifier
 * @param buffer - ArrayBuffer containing the file data
 * @returns Promise<string> - Hex string of the hash
 */
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
      source: z.nativeEnum(TestSource),
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
    // TODO: make hash content-based, not ZIP based
    const zipKey = await generateContentHash(buffer);
    // get env, wrapped from astro: https://docs.astro.build/en/guides/integrations-guide/cloudflare/#cloudflare-runtime
    const env = context.locals.runtime.env;
    // Check if this exact content already exists in D1
    const prisma = getPrismaClient(context);
    const existingTestId = await findTestIdByZipKey(prisma, zipKey);
    if (existingTestId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Duplicate uploads are not allowed.`,
          testId: existingTestId,
        }),
        {
          status: 409,
          headers: { 'Content-Type': 'application/json' },
        },
      );
    }
    // Confirm the config file exists
    const configFile = `config.json`;
    if (!files.includes(configFile)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No config.json file found in the ZIP archive',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Extract config.json
    const configBytes = unzipped[configFile];
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
    let config: ConfigJson;
    try {
      config = JSON.parse(configText);
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
    const testId = generateTestId();
    const testConfig: TestConfig = {
      testId,
      zipKey,
      name,
      description,
      source,
      url: config.url,
      testDate: Math.floor(new Date(config.date).getTime() / 1000),
      browser: config.options.browser,
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
    // store all unzipped files in R2 with {testId}/{filename} format
    for (const filename of files) {
      await env.RESULTS_BUCKET.put(`${testId}/${filename}`, unzipped[filename]);
    }

    // no need to disconnect manually b/c using Workers

    // return success
    return new Response(
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
  } catch (error) {
    console.error('Upload error:', error);

    // no need to disconnect manually b/c using Workers

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
