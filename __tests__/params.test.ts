import { spawnSync } from 'child_process';

import { retrieveConfig } from './helpers.js';
import type { SavedConfig } from '../src/types.js';

const baseParams = [
  'node',
  'dist/src/cli.js',
  '--dry',
  '--url',
  'https://www.example.com',
];

describe.each(['block', 'blockDomains'])(
  'CLI parameter array collapsing for --%s',
  param => {
    describe('Single string', () => {
      let config: SavedConfig | null;

      beforeAll(() => {
        const args = [...baseParams, `--${param}`, 'one'];

        const output = spawnSync(args[0], args.slice(1));
        const outputLogs = output.stdout.toString();
        const match = outputLogs.match(/Test ID:(.*)/);
        if (match && match.length > 1) {
          config = retrieveConfig(match[1].trim());
        }
      });

      it('generates a Configuration file', async () => {
        expect(config).toBeTruthy();
      });

      it(`${param} one`, async () => {
        expect(config?.options[param as keyof typeof config.options]).toEqual([
          'one',
        ]);
      });
    });

    describe('Two string options', () => {
      let config: SavedConfig | null;

      beforeAll(() => {
        const args = [...baseParams, `--${param}`, 'one', `--${param}`, 'two'];

        const output = spawnSync(args[0], args.slice(1));
        const outputLogs = output.stdout.toString();
        const match = outputLogs.match(/Test ID:(.*)/);
        if (match && match.length > 1) {
          config = retrieveConfig(match[1].trim());
        }
      });

      it('generates a configuration file', async () => {
        expect(config).toBeTruthy();
      });

      it(`${param} one and two`, async () => {
        expect(config?.options[param as keyof typeof config.options]).toEqual([
          'one',
          'two',
        ]);
      });
    });

    describe('Two comma separated strings', () => {
      let config: SavedConfig | null;

      beforeAll(() => {
        const args = [...baseParams, `--${param}`, 'one,two'];

        const output = spawnSync(args[0], args.slice(1));
        const outputLogs = output.stdout.toString();
        const match = outputLogs.match(/Test ID:(.*)/);
        if (match && match.length > 1) {
          config = retrieveConfig(match[1].trim());
        }
      });

      it('generates a configuration file', async () => {
        expect(config).toBeTruthy();
      });

      it(`${param} one and two`, async () => {
        expect(config?.options[param as keyof typeof config.options]).toEqual([
          'one',
          'two',
        ]);
      });
    });

    describe('JSON array', () => {
      let config: SavedConfig | null;

      beforeAll(() => {
        const args = [...baseParams, `--${param}`, '[ "one", "two" ]'];

        const output = spawnSync(args[0], args.slice(1));
        const outputLogs = output.stdout.toString();
        const match = outputLogs.match(/Test ID:(.*)/);
        if (match && match.length > 1) {
          config = retrieveConfig(match[1].trim());
        }
      });

      it('generates a configuration file', async () => {
        expect(config).toBeTruthy();
      });

      it(`${param} one and two`, async () => {
        expect(config?.options[param as keyof typeof config.options]).toEqual([
          'one',
          'two',
        ]);
      });
    });

    describe('Two JSON arrays', () => {
      let config: SavedConfig | null;

      beforeAll(() => {
        const args = [
          ...baseParams,
          `--${param}`,
          '[ "one" ]',
          `--${param}`,
          '[ "two" ]',
        ];

        const output = spawnSync(args[0], args.slice(1));
        const outputLogs = output.stdout.toString();
        const match = outputLogs.match(/Test ID:(.*)/);
        if (match && match.length > 1) {
          config = retrieveConfig(match[1].trim());
        }
      });

      it('generates a configuration file', async () => {
        expect(config).toBeTruthy();
      });

      it(`${param} one and two`, async () => {
        expect(config?.options[param as keyof typeof config.options]).toEqual([
          'one',
          'two',
        ]);
      });
    });

    describe('Two options with JSON arrays', () => {
      let config: SavedConfig | null;

      beforeAll(() => {
        const args = [
          ...baseParams,
          `--${param}`,
          '[ "one", "two" ]',
          `--${param}`,
          '[ "three", "four" ]',
        ];

        const output = spawnSync(args[0], args.slice(1));
        const outputLogs = output.stdout.toString();
        const match = outputLogs.match(/Test ID:(.*)/);
        if (match && match.length > 1) {
          config = retrieveConfig(match[1].trim());
        }
      });

      it('generates a configuration file', async () => {
        expect(config).toBeTruthy();
      });

      it(`${param} one, two, three and four`, async () => {
        expect(config?.options[param as keyof typeof config.options]).toEqual([
          'one',
          'two',
          'three',
          'four',
        ]);
      });
    });

    describe('Bad JSON option should fail', () => {
      let errLogs: string;

      beforeAll(() => {
        const args = [...baseParams, `--${param}`, "[ 'one', 'two' ]"];

        const output = spawnSync(args[0], args.slice(1));
        errLogs = output.stderr.toString();
      });

      it(`Problem parsing ${param} command line option`, async () => {
        const match = errLogs.match(/Error: Problem parsing (.*)/);
        expect(match?.length).toBeGreaterThan(1);
      });
    });
  },
);

describe('CLI should be logged in config.json', () => {
  let config: SavedConfig | null;

  beforeAll(() => {
    const output = spawnSync(baseParams[0], baseParams.slice(1));
    const outputLogs = output.stdout.toString();
    const match = outputLogs.match(/Test ID:(.*)/);
    if (match && match.length > 1) {
      config = retrieveConfig(match[1].trim());
    }
  });

  it('generates a Configuration file', async () => {
    expect(config).toBeTruthy();
  });

  it('captures CLI command in config', async () => {
    expect(config?.options.command).toEqual(baseParams.slice(2));
  });
});
