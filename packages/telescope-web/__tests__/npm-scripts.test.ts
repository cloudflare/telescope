import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
const execAsync = promisify(exec);
const PROJECT_ROOT = path.resolve(__dirname, '..');

function getPackageScripts(): Record<string, string> {
  const packageJson = JSON.parse(
    readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'),
  );
  return packageJson.scripts || {};
}

const scripts = getPackageScripts();
async function runScript(
  scriptName: string,
  timeout = 30000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  if (!scripts[scriptName]) {
    return {
      stdout: '',
      stderr: `Script "${scriptName}" not found in package.json`,
      exitCode: 1,
    };
  }
  try {
    const { stdout, stderr } = await execAsync(`npm run ${scriptName}`, {
      cwd: PROJECT_ROOT,
      timeout,
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (error: any) {
    return {
      stdout: error.stdout || '',
      stderr: error.stderr || '',
      exitCode: error.code || 1,
    };
  }
}

async function hasFiles(dirPath: string): Promise<boolean> {
  if (!existsSync(dirPath)) return false;
  try {
    const entries = await readdir(dirPath);
    return entries.length > 0;
  } catch {
    return false;
  }
}

describe('npm scripts functionality', () => {
  describe('build script', () => {
    const distPath = path.join(PROJECT_ROOT, 'dist');
    let buildResult: { stdout: string; stderr: string; exitCode: number };
    beforeAll(async () => {
      buildResult = await runScript('build:development', 120000);
    }, 120000);
    afterAll(() => {
      if (existsSync(distPath)) {
        rmSync(distPath, { recursive: true, force: true });
      }
    });
    it('should build successfully and create dist directory', async () => {
      expect(buildResult.exitCode).toBe(0);
      expect(existsSync(distPath)).toBe(true);
      const hasContent = await hasFiles(distPath);
      expect(hasContent).toBe(true);
    });
  });

  describe('Cloudflare worker types', () => {
    const workerTypesPath = path.join(
      PROJECT_ROOT,
      'worker-configuration.d.ts',
    );
    it('should include generated worker binding types', async () => {
      expect(existsSync(workerTypesPath)).toBe(true);
      const stats = await stat(workerTypesPath);
      expect(stats.size).toBeGreaterThan(0);
    });
  });

  it('exposes local and Cloudflare build commands', () => {
    expect(scripts.build).toBe('astro build');
    expect(scripts['build:cloudflare']).toContain('DEPLOY_TARGET=cloudflare');
    expect(scripts.start).toBe('node dist/server/entry.mjs');
  });
});
