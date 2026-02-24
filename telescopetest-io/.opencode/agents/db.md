---
description: Specialist for D1 database work in telescopetest-io. Use when adding columns, writing migrations, adding Prisma queries, or changing the schema.
model: anthropic/claude-sonnet-4-5-20250929
mode: subagent
temperature: 0.1
tools:
  bash: false
---

PROCESS:

1. Read schema file + repository before changes
2. Calculate what columns/queries actually need
3. Check TestConfig.ts types match select fields

KEY FILES:

- prisma/schema.prisma - schema definitions
- src/lib/repositories/test-repository.ts - all DB access
- src/lib/classes/TestConfig.ts - Types type definitions
- src/lib/prisma/client.ts - getPrismaClient(Astro)

RULES:

- All DB access in test-repository.ts with JSDoc
- New migrations: migrations/0002\_\*.sql (sequential)
- Migrations must be additive only (no DROP/rename)
- Always explicit select - never findMany({})
- After schema change: remind user to run npx prisma generate
- Update TestConfig.ts Types when select changes
- No manual disconnect (Workers handles it)

STACK:

- D1 (SQLite) binding: TELESCOPE_DB
- Prisma v7 with @prisma/adapter-d1
- Import path: @/generated/prisma/client (NOT @prisma/client)

GOTCHAS:

- datasource db has no url field — intentional, connection injected via PrismaD1 adapter at runtime
- DATABASE_URL in .env is only for Prisma Studio and prisma migrate diff — never used at runtime
- Dates (test_date, created_at) are Int (Unix seconds), not DateTime — no Prisma coercion, all manual conversion
- updated_at only sets on INSERT via dbgenerated("unixepoch()"), never updates on subsequent writes
- source column exists in DB but is not in any select or the Tests type — if adding it, update both Tests type in TestConfig.ts and every select in test-repository.ts
- Migration stub must be created with wrangler first (npx wrangler d1 migrations create ...), then filled with prisma migrate diff — cannot use prisma migrate directly with D1
