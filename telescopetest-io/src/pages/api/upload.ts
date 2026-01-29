import type { APIRoute } from 'astro';
import { TestConfig, TestSource } from '../../types/testConfig';
import { TestRepository } from '../../lib/d1/repositories/test-repository';
import { R2Client } from '../../lib/r2/r2-client';
export const prerender = false;

/**
 * Extract file list from ZIP archive
 * Works in both Node.js (adm-zip) and Cloudflare Workers (fflate) environments
 * @param buffer - ArrayBuffer containing ZIP file data
 * @returns Promise<string[]> - Array of file paths/names in the ZIP
 */
async function getFilesFromZip(
  buffer: ArrayBuffer,
): Promise<Record<string, any>> {
  const { unzipSync } = await import('fflate');
  const uint8Array = new Uint8Array(buffer);
  const unzipped = unzipSync(uint8Array);
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


export const POST: APIRoute = async (context: any) => {
  try {
    const formData = await context.request?.formData();
    const file = formData.get('file') as File;
    if (!file) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    // Read file buffer
    const buffer = await file.arrayBuffer();
    const unzipped = await getFilesFromZip(buffer);
    const files = Object.keys(unzipped).filter(name => !name.endsWith('/'));
    // Generate content-based hash for unique R2 storage key
    const zipKey = await generateContentHash(buffer);
    // get env, wrapped from astro: https://docs.astro.build/en/guides/integrations-guide/cloudflare/#cloudflare-runtime 
    const env = context.locals?.runtime?.env;
    const testRepo = new TestRepository(env.TELESCOPE_DB);
    const r2Client = new R2Client(env.RESULTS_BUCKET);
    // Check if this exact content already exists in D1
    const existing = await testRepo.findTestByZipKey(zipKey);
    if (existing) {
      return new Response(
        JSON.stringify({
          error: 'This test content already exists. Duplicate uploads are not allowed.',
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
        { status: 402, headers: { 'Content-Type': 'application/json' } },
      );
    }
    // Extract and parse config.json
    const configData = unzipped[configFile];
    if (!configData) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to extract config.json from ZIP',
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } },
      );
    }
    const configText = new TextDecoder('utf-8').decode(configData);
    const config = JSON.parse(configText);
    const source = formData.get('source');
    let testConfig = TestConfig.fromConfig(config, zipKey);
    switch (source) {
      // if the source is upload, then we also need to get the name and description from the form data
      case TestSource.UPLOAD:
        testConfig.name = formData.get('name') as string;
        testConfig.description = formData.get('description') as string;
        testConfig.source = source as TestSource;
        break;
      // if the source is api, then we don't need to add name/desc -> need to test 
      case TestSource.API:
        break;
      // if the source is agent, then we don't need to add name/desc -> need to test 
      case TestSource.AGENT:
        break;
    }
    // store the test config (metadata) in the db
    await testRepo.create(testConfig);
    const testId = await testRepo.findTestIdByZipKey(zipKey);
    if (!testId) {
      throw new Error('Failed to retrieve test_id after insert');
    }
    // store all unzipped files in R2 with {testId}/{filename} format
    // storing with {testId}/ for future expansion to multiple users
    for (const filename of files) {
      await r2Client.put(`${testId}/${filename}`, unzipped[filename]);
    }
    return new Response(
      JSON.stringify({
        success: true,
        testId: testConfig.test_id, // returned to upload.astro on success
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
