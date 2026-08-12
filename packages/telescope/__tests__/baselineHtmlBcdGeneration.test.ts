import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { expect, test } from 'vitest';

const packageDirectory = fileURLToPath(new URL('..', import.meta.url));

test('the committed HTML BCD constants match the installed BCD data', () => {
  const result = spawnSync(
    process.execPath,
    ['scripts/generateBaselineHtmlBcd.mjs', '--check'],
    {
      cwd: packageDirectory,
      encoding: 'utf8',
    },
  );

  expect(result.status, `${result.stdout}${result.stderr}`).toBe(0);
});
