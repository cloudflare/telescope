import type { APIContext, APIRoute } from 'astro';
import type { Unzipped } from 'fflate';

import { unzipSync } from 'fflate';
import { z } from 'zod';

import { TestConfig, TestSource } from '@/lib/classes/TestConfig';
import { D1TestStore } from '@/lib/d1/test-store/d1-test-store';

export const prerender = false;

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
    // const files = Object.keys(unzipped).filter(name => !name.endsWith('/'));
    // Generate content-based hash for unique R2 storage key
    const zipKey = await generateContentHash(buffer);
    // get env, wrapped from astro: https://docs.astro.build/en/guides/integrations-guide/cloudflare/#cloudflare-runtime
    const env = context.locals.runtime.env;
    const testStore = new D1TestStore(env.TELESCOPE_DB);
    // Check if this exact content already exists in D1
    const existingTestId = await testStore.findTestIdByZipKey(zipKey);
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
    let config;
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
    // create testConfig (ts class) object
    let testConfig = new TestConfig(config, zipKey, source, name, description);
    // store the test config (metadata) in the db
    try {
      await testStore.createTestFromConfig(testConfig);
    } catch (error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Failed to insert test: ${(error as Error).message}`,
        }),
        { status: 500, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const testId = testConfig.test_id; // generated in constructor
    // store all unzipped files in R2 with {testId}/{filename} format
    // storing with {testId}/ for future expansion to multiple users
    for (const filename of files) {
      await env.RESULTS_BUCKET.put(`${testId}/${filename}`, unzipped[filename]);
    }
    return new Response(
      JSON.stringify({
        success: true,
        testId: testId, // returned to upload.astro on success
        message: 'Upload processed successfully',
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
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
