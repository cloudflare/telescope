# Telescope — Agent Guide

## Repository Overview

`@cloudflare/telescope` is a TypeScript browser performance testing library and CLI built on Playwright. It launches real browsers (Chrome, Firefox, Safari, Edge), collects HAR files, Web Vitals, and performance metrics, and produces HTML reports.

Key subdirectories:

- `src/` — TypeScript source compiled to `dist/`
- `__tests__/` — Vitest integration tests (excluded from tsconfig)
- `processors/` — Standalone post-processing report generator (included in main tsconfig)
- `telescopetest-io/` — Separate Astro + Cloudflare Workers web app (fully excluded from root tooling)

---

## Build, Lint, and Test Commands

### Build

```bash
npm run build          # tsc + copy templates to dist/
npm run dev            # tsc --watch
```

**Tests require a build first.** Some tests invoke `node dist/src/cli.js` via `spawnSync`, so they test compiled output.

### Lint

```bash
npm run lint           # eslint .
npm run lint:fix       # eslint . --fix
npm run prettier       # npx prettier --write .
```

### Test

```bash
npm test               # build + vitest run
npm run test:ci        # CI=true npm test
npm run coverage       # vitest run --coverage
```

**Run a single test file** (build first):

```bash
npm run build && npx vitest run __tests__/cli.test.ts
```

**Run a single test by name:**

```bash
npm run build && npx vitest run __tests__/cli.test.ts -t "generates a Har file"
```

**Important:** `maxWorkers: 1` is required — tests launch real browsers and cannot run in parallel. Tests that call `launchTest()` or spawn the CLI directly need explicit timeouts (60000–120000ms). See `vitest.config.ts` for configuration.

---

## TypeScript Configuration

- **Target**: ES2022, **Module**: NodeNext, **ModuleResolution**: NodeNext
- **Strict mode**: fully enabled (`strict: true`)
- Additional strict flags: `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`, `noFallthroughCasesInSwitch`
- **All local imports must use `.js` extensions** even when importing `.ts` source files — required by `module: NodeNext`

```typescript
// Correct
import { log } from './helpers.js';
import type { LaunchOptions } from './types.js';

// Wrong — will fail to resolve
import { log } from './helpers';
```

---

## Code Style Guidelines

### Imports

- Use **named imports** as the default; use default imports only for packages that export a default (e.g., `playwright`, `path`, `ejs`)
- Use **`import type { ... }`** for all type-only imports — enforced by ESLint (`@typescript-eslint/consistent-type-imports: error`)
- No path aliases — use relative paths (`./types.js`, `../src/index.js`)
- Group: external packages first, then internal relative imports

```typescript
import { Command, Option } from 'commander';
import playwright from 'playwright';

import type { BrowserContext } from 'playwright';
import type { LaunchOptions, TestResult } from './types.js';
import { log, generateTestID } from './helpers.js';
```

### Formatting (Prettier)

- **Single quotes** for strings
- **2-space indentation**
- **Trailing commas** everywhere (arrays, objects, function parameters)
- **No parentheses** on single-argument arrow functions: `x => x * 2` not `(x) => x * 2`
- EJS templates formatted via `prettier-plugin-ejs`

### Naming Conventions

| Entity                   | Convention         | Example                                                    |
| ------------------------ | ------------------ | ---------------------------------------------------------- |
| Files                    | `camelCase.ts`     | `testRunner.ts`, `defaultOptions.ts`                       |
| Classes                  | `PascalCase`       | `TestRunner`, `BrowserConfig`, `ChromeRunner`              |
| Interfaces               | `PascalCase`       | `LaunchOptions`, `NetworkProfile`, `TestPaths`             |
| Type aliases             | `PascalCase`       | `BrowserName`, `ConnectionType`, `TestResult`              |
| Functions                | `camelCase`        | `launchTest()`, `normalizeCLIConfig()`, `generateTestID()` |
| Constants                | `UPPER_SNAKE_CASE` | `DEFAULT_OPTIONS`                                          |
| Class methods/properties | `camelCase`        | `setupTest()`, `browserConfig`, `consoleMessages`          |
| Unused parameters        | prefix with `_`    | `_cleanupError`, `_unusedArg`                              |

### Types

- **All shared types** live in `src/types.ts` — the single source of truth. Add new types there.
- Use **`interface`** for objects with multiple properties; **`type`** for unions, primitives, and derived types
- Use `Record<K, V>` for maps, `Partial<T>` for optional shapes, `Pick<T, K>` for property subsets
- Use utility types to derive rather than duplicate: `Exclude<ConnectionType, false>`, `Parameters<BrowserContext['addCookies']>[0][number]`
- Avoid `any` — `@typescript-eslint/no-explicit-any: error` is enforced. Use `unknown` and narrow with `instanceof` or type guards
- Type assertion on caught errors: `(error as Error).message` (no `unknown`-based helper utility currently in use)
- Augment `Window` in `src/types.ts` via `declare global { interface Window { ... } }`

### Error Handling

Three patterns in use:

**1. Public API never throws — discriminated union result:**

```typescript
export async function launchTest(options: LaunchOptions): Promise<TestResult> {
  try {
    return await executeTest(options);
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
}
```

Callers narrow with `if (result.success) { ... }`.

**2. Cleanup-even-on-error (resource management):**

```typescript
try {
  await Runner.setupTest();
  await Runner.doNavigation();
} catch (error) {
  try {
    await Runner.cleanup();
  } catch (_cleanupError) {
    /* Ignore */
  }
  throw error;
}
```

**3. Non-fatal file I/O errors — log and continue:**

```typescript
try {
  writeFileSync(path, JSON.stringify(data), 'utf8');
} catch (err) {
  console.error('Error writing file: ' + err);
}
```

Validation errors throw directly: `throw new Error('Invalid browser name')`.

### Class and Module Organization

- **One class per file**; file name matches the class name in `camelCase`
- **Named exports** for everything (no `export default` for classes)
- Use **inheritance sparingly**: `ChromeRunner extends TestRunner` is the only hierarchy — subclass only to add browser-specific protocol logic (CDP), not general behavior
- Factory functions select the right class: `getRunner(browserConfig)` returns `TestRunner | ChromeRunner`
- Use **`DEFAULT_OPTIONS`** in `src/defaultOptions.ts` as the canonical source for defaults — do not hardcode defaults in Commander.js options and the programmatic API separately

### JSDoc

Add JSDoc to all public API functions and class methods:

```typescript
/**
 * Launches a browser performance test.
 * @param options - Test configuration
 * @returns Discriminated union: success result with testId, or failure with error message
 * @throws Never — all errors are caught and returned as { success: false }
 */
export async function launchTest(options: LaunchOptions): Promise<TestResult> { ... }
```

---

## Testing Guidelines

- **Framework**: Vitest v4 + @vitest/coverage-v8 (ESM mode)
- **Test files**: `__tests__/*.test.ts` only — helper utilities go in `__tests__/helpers.ts`
- **Test style**: Integration tests that launch real browsers. Unit tests are rare.
- Tests use `describe.each(browsers)` to run across the browser matrix
- In CI (`process.env.CI === 'true'`), only Firefox runs; locally, all 6 browsers run
- Shared test helpers (`retrieveHAR`, `retrieveConfig`, `retrieveMetrics`) live in `__tests__/helpers.ts`
- Use `msw/node` (`setupServer`, `http`, `HttpResponse`) to mock HTTP endpoints (e.g., upload APIs)
- Tests that invoke the CLI use `spawnSync('node', ['dist/src/cli.js', ...])` — always build first

```typescript
// Typical parameterized test
describe.each(browsers)('Feature: %s', browser => {
  let result: SuccessfulTestResult;

  beforeAll(async () => {
    const testResult = await launchTest({
      url: 'https://example.com',
      browser,
    });
    if (!testResult.success) throw new Error(testResult.error);
    result = testResult;
  }, 120000); // always set explicit timeout for browser tests

  it('produces a HAR file', () => {
    expect(retrieveHAR(result.testId)).toBeTruthy();
  });
});
```

---

## Validation

CLI options and programmatic inputs are validated using **Zod** schemas:

- **Schemas** are defined in `src/schemas.ts` — includes `CookieSchema`, `HeadersSchema`, `AuthSchema`, `FirefoxPrefsSchema`, `DelaySchema`, `PositiveIntSchema`, `PositiveFloatSchema`, etc.
- **Validation utilities** are in `src/validation.ts`:
  - `parseCLIOption(flagName, jsonString, schema)` — parses JSON strings from CLI args and validates against schema
  - `parseUnknown(flagName, data, schema)` — validates already-parsed data
  - `parseWithSchema(schema, value, flag)` — coerces and validates raw CLI strings
  - `formatZodError(error)` — formats Zod validation errors for CLI output

Validation is integrated into the CLI via Commander.js `argParser` functions that throw `InvalidArgumentError` on failure.

---

## Docker

The project includes Docker support for containerized testing:

- **Dockerfile** — Multi-stage build with Playwright dependencies
- **docker-compose.yml** — Service orchestration

Build and run:

```bash
docker build -t telescope .
docker run --rm -v $(pwd)/results:/app/results telescope --url https://example.com
```

---

## Architecture Notes

- **`telescopetest-io/`** is a fully independent project — do not touch its files when working on the core library. It has its own `package.json` and is excluded from root `tsconfig.json`, ESLint, Vitest, and Prettier configs.
- **Processors** (`processors/generate.ts`) are compiled with the main build but run as a standalone script: `node dist/processors/generate.js <results-dir>`. Guarded with `if (process.argv[1] === __filename)`.
- **Runtime path resolution**: `testRunner.ts` detects whether it is running from compiled `dist/` or source via `currentDir.includes('/dist/')` — preserve this logic when modifying path-dependent code.
- **Template files** are copied post-`tsc` in the `build` script — if you add new `.ejs` templates under `src/templates/`, update the `build` script accordingly.
