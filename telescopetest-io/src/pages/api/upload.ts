import type { APIRoute } from 'astro';
import { TestConfig, TestSource } from '../../types/testConfig';

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
    console.log('LOG: zipKey (content hash): ', zipKey);
    console.log('LOG: files: ', files);

    // get env (pass into other functions) -> could put in try except ? 
    const env = context.env || context.locals?.runtime?.env;

    // Check if this exact content already exists in R2 -> check for anything starting with '{zipKey}/'
    const existing = await env.RESULTS_BUCKET.list({ prefix: `${zipKey}/`, limit: 1 });
    if (existing.objects.length > 0) {
      return new Response(
        JSON.stringify({
          error:
            'This test content already exists. Duplicate uploads are not allowed.',
        }),
        {
          status: 409, // duplicate 
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
        console.log('LOG: hit upload as the source');
        testConfig.name = formData.get('name') as string;
        testConfig.description = formData.get('description') as string;
        testConfig.source = source as TestSource;
        break;
      // if the source is api, then we don't need to do anything
      case TestSource.API:
        break;
      // if the source is agent, then we don't need to do anything
      case TestSource.AGENT:
        break;
    }
    console.log('LOG: current testConfig: ', testConfig);

    // Store all unzipped files in R2 with {zipKey}/{filename} format
    for (const filename of files) {
      await env.RESULTS_BUCKET.put(`${zipKey}/${filename}`, unzipped[filename]);
    }

    // store the test config (metadata) in the db
    await testConfig.saveToD1(env); // will throw error if duplicate zip_key
    return new Response(
      JSON.stringify({
        success: true,
        testId: testConfig.test_id,
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
