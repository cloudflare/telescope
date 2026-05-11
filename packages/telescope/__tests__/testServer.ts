import type { AddressInfo } from 'node:net';
import { createServer, type Server } from 'node:http';
import { gzipSync } from 'node:zlib';
import { readFile } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { expect } from 'vitest';

import { cleanupTestDirectory, retrieveHAR, blockingSleep } from './helpers.js';
import { launchTest } from '../src/index.js';
import { HarData, LaunchOptions, mimeTypes, testServerConfig, SuccessfulTestResult } from '../src/types.js';

const projectRoot = dirname(dirname(fileURLToPath(import.meta.url)));

/**
 * Path to the files the test web server will serve
 **/

export function fixturesDir(name: string): string {
  return join(projectRoot, 'tests', name);
}

/**
 * Launches a test, asserts success, retrieves the HAR, and cleans up the test
 * directory after the callback finishes (even on failure).
 */

export async function withHAR(
  options: LaunchOptions,
  callback: (har: HarData) => void,
): Promise<void> {
  const result = await launchTest(options);
  if (!result.success) {
    console.error(result.error);
  }

  expect(result.success).toBe(true);

  const testId = (result as SuccessfulTestResult).testId;
  try {
    const har = retrieveHAR(testId);
    expect(har).not.toBeNull();
    callback(har!);
  } finally {
    cleanupTestDirectory(testId);
  }
}

/**
 * Creates a static-file HTTP server that serves the given files from
 * the specified fixtures directory. Call `listenServer()` to start it.
 */
export function createStaticServer(
  config: testServerConfig
): Server {
  return createServer(async (req, res) => {
    if (req.url.startsWith('/')) {
      let acceptEncoding = req.headers['accept-encoding'];

      if (config.delay) {
        // Pause for delay milliseconds to simulate processing
        blockingSleep(config.delay);
      }

      if (req.url === '/' || req.url === '/index.html') {
        try {
          const filePath = join(config.fixturesDirPath, 'index.html');
          const data = await readFile(filePath);

          if (config.compress && acceptEncoding.includes('gzip')) {
            res.writeHead(200, {
              'Content-Type': 'text/html',
              'Content-Encoding': 'gzip'
            });

            const compressed = gzipSync(data, { level: config.compress });
            res.end(compressed);
          } else {
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
          }
        } catch (err) {
          console.error(err);
          res.writeHead(404);
          res.end('Not found');
        }
        return;
      }

      // Parse the URL
      const urlObject = new URL(`http://localhost${req.url}`);
      const filePath = join(config.fixturesDirPath, urlObject.pathname);

      try {
        const data = await readFile(filePath);
        const ext = filePath.split('.').pop() ?? '';
        const contentType = mimeTypes[ext] ?? 'application/octet-stream';

        if (config.compress && acceptEncoding.includes('gzip') &&
          (ext === 'css' || ext === 'js')) {
          res.writeHead(200, {
            'Content-Type': contentType,
            'Content-Encoding': 'gzip'
          });

          const compressed = gzipSync(data, { level: config.compress });
          res.end(compressed);
        } else {
          res.writeHead(200, { 'Content-Type': contentType });
          res.end(data);
        }
      } catch {
        res.writeHead(404);
        res.end('Not found');
      }
    } else{
      res.writeHead(404);
      res.end('Not found');
    }
  });
}

export async function listenServer(srv: Server): Promise<string> {
  await new Promise<void>(resolve => srv.listen(0, '127.0.0.1', resolve));
  const addr = srv.address() as AddressInfo;
  return `http://127.0.0.1:${addr.port}`;
}

export async function shutdownServer(srv: Server): Promise<void> {
  await new Promise<void>(resolve => srv.close(() => resolve()));
}

