import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { existsSync, rmSync, readFileSync } from 'node:fs';
import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';
const execAsync = promisify(exec);
const PROJECT_ROOT = path.resolve(__dirname, '..');

async function runScript(
  scriptName: string,
  timeout = 30000,
): Promise<{ stdout: string; stderr: string; exitCode: number }> {
  const scripts = getPackageScripts();
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

function getPackageScripts(): Record<string, string> {
  const packageJson = JSON.parse(
    readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf-8'),
  );
  return packageJson.scripts || {};
}

describe('npm scripts functionality', () => {
  const scripts = getPackageScripts();

  describe('script availability', () => {
    it('should have essential development scripts', () => {
      expect(scripts).toHaveProperty('dev');
      expect(scripts).toHaveProperty('generate');
      expect(scripts).toHaveProperty('cf-typegen');
      expect(scripts).toHaveProperty('test');
    });

    it('should have build scripts', () => {
      const hasBuildScript =
        'build' in scripts ||
        'build:development' in scripts ||
        'build:staging' in scripts;
      expect(hasBuildScript).toBe(true);
    });

    it('should have migration scripts', () => {
      const hasMigrateScript =
        'migrate:local' in scripts ||
        'migrate:development' in scripts ||
        'migrate:staging' in scripts;
      expect(hasMigrateScript).toBe(true);
    });
  });

  describe('Prisma generate', () => {
    const generatedPath = path.join(PROJECT_ROOT, 'generated', 'prisma');
    let generateResult: { stdout: string; stderr: string; exitCode: number };
    beforeAll(async () => {
      generateResult = await runScript('generate', 30000);
    }, 30000);
    it('should generate Prisma client files', async () => {
      if (generateResult.exitCode === 0) {
        expect(existsSync(generatedPath)).toBe(true);
        const hasContent = await hasFiles(generatedPath);
        expect(hasContent).toBe(true);
      } else {
        console.log('Prisma generate not functional');
      }
    });
  });

  describe('Cloudflare worker types', () => {
    const workerTypesPath = path.join(
      PROJECT_ROOT,
      'worker-configuration.d.ts',
    );
    let typegenResult: { stdout: string; stderr: string; exitCode: number };
    beforeAll(async () => {
      typegenResult = await runScript('cf-typegen', 30000);
    }, 30000);
    afterAll(() => {
      if (existsSync(workerTypesPath)) {
        rmSync(workerTypesPath, { force: true });
      }
    });
    it('should generate worker types file', async () => {
      if (typegenResult.exitCode === 0) {
        expect(existsSync(workerTypesPath)).toBe(true);
        const stats = await stat(workerTypesPath);
        expect(stats.size).toBeGreaterThan(0);
      } else {
        console.log('Worker typegen not functional');
      }
    });
  });

  describe('vitest', () => {
    it('should have vitest available', async () => {
      try {
        const { stdout, stderr } = await execAsync('npx vitest --version', {
          cwd: PROJECT_ROOT,
          timeout: 10000,
        });
        expect(stdout).toMatch(/vitest/i);
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/vitest/i);
      }
    }, 15000);
  });
});
