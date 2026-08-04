import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

const packageDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const migrationsDirectory = path.join(packageDirectory, 'migrations');
const migrationPattern = /^(\d+)_.*\.sql$/;

function migrationSlug(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function hasSchemaChanges(sql) {
  return sql
    .split('\n')
    .some(line => line.trim() && !line.trim().startsWith('--'));
}

function runPrismaDiff(databasePath) {
  const result = spawnSync(
    'prisma',
    [
      'migrate',
      'diff',
      '--from-config-datasource',
      '--to-schema',
      'prisma/schema.prisma',
      '--script',
    ],
    {
      cwd: packageDirectory,
      encoding: 'utf8',
      env: {
        ...process.env,
        DATABASE_URL: `file:${databasePath}`,
      },
    },
  );

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || 'Prisma schema diff failed');
  }

  return result.stdout.trim();
}

async function main() {
  const checkOnly = process.argv[2] === '--check';
  const requestedName = process.argv.slice(2).join(' ');
  const slug = checkOnly ? '' : migrationSlug(requestedName);

  if (!checkOnly && !slug) {
    throw new Error(
      'Provide a migration name, for example: npm run migration:create -- add_owner',
    );
  }

  const migrationFiles = (await readdir(migrationsDirectory))
    .filter(file => migrationPattern.test(file))
    .sort((left, right) => left.localeCompare(right));

  if (migrationFiles.length === 0) {
    throw new Error('No existing D1 migrations were found');
  }

  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), 'telescope-d1-schema-'),
  );
  const databasePath = path.join(temporaryDirectory, 'baseline.sqlite');

  try {
    const database = new DatabaseSync(databasePath);
    try {
      for (const migrationFile of migrationFiles) {
        database.exec(
          await readFile(
            path.join(migrationsDirectory, migrationFile),
            'utf8',
          ),
        );
      }
    } finally {
      database.close();
    }

    const sql = runPrismaDiff(databasePath);
    const changed = hasSchemaChanges(sql);

    if (checkOnly) {
      if (changed) {
        process.stderr.write(
          `Prisma schema and D1 migrations differ:\n\n${sql}\n`,
        );
        process.exitCode = 1;
      } else {
        process.stdout.write('Prisma schema matches the D1 migrations.\n');
      }
      return;
    }

    if (!changed) {
      throw new Error('Prisma schema has no changes to migrate');
    }

    const lastSequence = Math.max(
      ...migrationFiles.map(file => Number(file.match(migrationPattern)[1])),
    );
    const migrationFile = `${String(lastSequence + 1).padStart(4, '0')}_${slug}.sql`;
    const migrationPath = path.join(migrationsDirectory, migrationFile);

    const validationDatabase = new DatabaseSync(databasePath);
    try {
      validationDatabase.exec(sql);
    } finally {
      validationDatabase.close();
    }

    await writeFile(migrationPath, `${sql}\n`, { flag: 'wx' });
    process.stdout.write(`Created migrations/${migrationFile}\n`);
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true });
  }
}

main().catch(error => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
