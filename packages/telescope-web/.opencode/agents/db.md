---
description: Specialist for D1 database work in telescope-web. Use when adding columns, writing migrations, adding Prisma queries, or changing the schema.
model: anthropic/claude-sonnet-4-6
mode: subagent
temperature: 0.1
tools:
  bash: false
---

PROCESS:

1. Read schema file + repository before changes
2. Calculate what columns/queries actually need
3. Check src/lib/types/tests.ts types match select fields

KEY FILES:

- prisma/schema.prisma - schema definitions
- src/lib/repositories/testRepository.ts - all DB access
- src/lib/types/tests.ts - Test type, ContentRating enum, TestSource enum
- src/middleware.ts - Prisma client initialization (singleton pattern)

RULES:

- All DB access in testRepository.ts with JSDoc
- New migrations: migrations/0003\_\*.sql (sequential, next is 0003)
- Migrations must be additive only (no DROP/rename)
- Always explicit select - never findMany({})
- After schema change: remind user to run npm run generate
- Update src/lib/types/tests.ts Test type when select changes
- No manual disconnect (Workers handles it)
- Prisma client injected via context.locals.prisma in middleware

STACK:

- D1 (SQLite) binding: TELESCOPE_DB
- Prisma v7.5.0 with @prisma/adapter-d1
- Import path: @/generated/prisma/client (NOT @prisma/client)
- Schema generator runtime: "cloudflare" (required for Workers compat)

MIGRATION WORKFLOW:

Read the README.md

GOTCHAS:

- datasource db has no url field — intentional, connection injected via PrismaD1 adapter at runtime in middleware.ts
- DATABASE_URL in .env is only for Prisma Studio and prisma migrate diff — never used at runtime
- Dates (test_date, created_at, updated_at) are Int (Unix seconds), not DateTime — no Prisma coercion, all manual conversion
- created_at sets via dbgenerated("(unixepoch())") on INSERT only, never updates
- content_rating field: ContentRating enum (SAFE/UNSAFE/UNKNOWN/IN_PROGRESS) - affects visibility in results list
- source field: TestSource enum (stored in DB but NOT in select or Test type) — if adding it, update both
- Cannot use prisma migrate dev with D1 — must use manual wrangler workflow
- Prisma client output: generated/prisma/ (gitignored) — must regenerate on fresh clone
