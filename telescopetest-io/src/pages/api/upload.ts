import type { APIRoute } from 'astro';
import { TestConfig, TestSource } from '../../types/testConfig';

export const prerender = false; // make SSR because needs dynamic backend services


/**
 * Extract file list from ZIP archive
 * Works in both Node.js (adm-zip) and Cloudflare Workers (fflate) environments
 * @param buffer - ArrayBuffer containing ZIP file data
 * @returns Promise<string[]> - Array of file paths/names in the ZIP
 */
async function getFilesFromZip(buffer: ArrayBuffer): Promise<Record<string, any>> {
  const { unzipSync } = await import('fflate');
  const uint8Array = new Uint8Array(buffer);
  const unzipped = unzipSync(uint8Array);
  return unzipped;
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
    const fileKey = Object.keys(unzipped).filter(name => name.endsWith('/'))[0].replace('/', '');

    // Access D1 database - try both env parameter and context.locals.runtime
    const env = context.env || context.locals?.runtime?.env;
    console.log("this is env: ", env);
    const existing = await env.RESULTS_BUCKET.get(fileKey);
    if (existing) {
      return new Response(JSON.stringify({ error: 'Test already exists' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      });
    }
    const configFile = `${fileKey}/config.json`;
    if (!files.includes(configFile)) {  // check if the config file exists  
      return new Response(JSON.stringify({
        success: false,
        error: 'No config.json file found in the ZIP archive'
      }), { status: 402, headers: { 'Content-Type': 'application/json' } });
    }

    // Extract and parse config.json - fflate returns Uint8Array, need to decode to string
    const configData = unzipped[configFile];
    if (!configData) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Failed to extract config.json from ZIP'
      }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const configText = new TextDecoder('utf-8').decode(configData);
    const config = JSON.parse(configText);

    let testConfig = TestConfig.fromConfig(fileKey, config);
    switch (testConfig.source) {
      // if the source is upload, then we need to get the name and description from the form data
      case TestSource.UPLOAD:
        testConfig.name = formData.get('name') as string;
        testConfig.description = formData.get('description') as string;
        testConfig.source = (formData.get('source') as TestSource)
        break;
      // if the source is api, then we don't need to do anything
      case TestSource.API:
        break;
      // if the source is agent, then we don't need to do anything
      case TestSource.AGENT:
        break;
    }

    // store the zip file in the results bucket
    // metadata will be pulled from the db
    await env.RESULTS_BUCKET.put(fileKey, buffer);
    // store the test config in the db
    await testConfig.saveToD1(env);
    return new Response(JSON.stringify({
      success: true,
      testId: testConfig.test_id,
      message: 'Upload processed successfully'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Upload error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: (error as Error).message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};


