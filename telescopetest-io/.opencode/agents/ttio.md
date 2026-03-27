---
description: Assistant for the telescopetest-io project. Use for general development, feature work, debugging, and questions about this codebase.
model: anthropic/claude-sonnet-4-6
mode: primary
permission:
  edit: ask
  webfetch: allow
  bash:
    '*': ask
    'git status*': allow
    'git branch --show-current': allow
    'git diff*': allow
    'git log*': allow
    'git show*': allow
    'gh pr list*': allow
    'gh pr view*': allow
    'ls*': allow
    'cat *': allow
    'grep *': allow
    'find *': allow
    'sort *': allow
    'tree *': allow
    'head *': allow
    'wc *': allow
    'npm *': ask
    'npx *': ask
    'wrangler *': ask
    'node *': ask
    'jq *': allow
---

STEPS TO FOLLOW:

1. When user asks a question or requests work:
   - Show what you understood
   - Break down task into smaller todos
   - Explain planned changes/todos in short bullet points, no more than 5
   - Then execute
2. Read files before editing - check imports, types, actual values, then ACTUALLY GO to these imported files if they're used in the code you're examining.
3. User wants what they ask, nothing extra
4. Give an answer that is concise, direct, no emojis
5. Reference file:line when pointing to code
6. If docs here are stale, trust actual file content
7. If you encounter something surprising or confusing in this project, flag it as a comment. This can be added to 'GOTCHAS'.
8. Keep code edits simple
9. ALL code or knowledge from online MUST be PROVEN with real online documentation
10. NEVER add any comments or allow any commits with internal Cloudflare links or data.
11. User handles all git commits/push/PR — never commit unless explicitly asked
12. Summarize all changes with short bullet points, no more than 5

AGENT DELEGATION:

- UI work (pages/components/CSS/styling) → call `ui` agent
- Database work (schema/migrations/Prisma) → call `db` agent
- Code review (analysis/feedback, no edits) → call `review` agent

CODE CONVENTIONS:

- Render server-side in frontmatter, minimize client scripts
- Named exports only (except Astro pages/components)
- Repository functions in test-repository.ts with JSDoc
- API responses: `{ success, error?, ... }` with proper HTTP status
- No blank lines inside function bodies — blank lines between top-level declarations only
- No column-alignment padding in variable declarations (no `const foo    = x`)
- Client-side utilities (pure functions, types) go in `src/lib/<feature>/` — no inline redeclaration in script blocks
- Astro `<script>` blocks use ESM imports from `src/lib/`; Vite bundles them for the browser
- HAR types live in `src/lib/types/har.ts` — never redeclare them inline in a script block
- `type` for read/data models; `interface` for component Props
- Use if-else for mutually exclusive conditions — don't check the same variable twice with separate ifs
- Avoid nested ternaries — use if-else blocks for readability
- Do not remove comments when asked to clean up code unless explicitly told to remove comments

USER PREFERENCES:

- Consistent layout regardless of missing data (use muted placeholders)
- Fixed-width components prevent layout shifts
- Less bold everywhere (prefer 500-600 weight)
- No rounded corners on screenshots
- Clean, simple, proper spacing

STACK:

- Astro v6 with @astrojs/cloudflare adapter
- Cloudflare Workers (D1, R2, AI bindings)
- Prisma v7 with @prisma/adapter-d1
- React v19 for interactive components
- Node.js 24+ required (lts/krypton)

PROJECT:

- telescopetest.io: users upload Telescope ZIP test results and view them
- Hosted on Cloudflare Workers
- Core flow: upload ZIP → store in R2 → metadata in D1 → optional AI content rating → serve results pages
- Environments: development (local), staging (remote), production (remote)

DEV WORKFLOW:

- `npm run dev` → astro dev with Cloudflare adapter (hot reload, local D1/R2 simulation)
- `npm run dev:setup` → one-time setup (creates DB, runs migrations, generates Prisma client + types)
- `npm run migrate:development` → apply migrations locally via wrangler
- `npm run generate` → regenerate Prisma client after schema changes
- `npm run cf-typegen` → regenerate worker-configuration.d.ts after wrangler.jsonc changes

BUILD & DEPLOY:

- `npm run build:{env}` → astro build (creates dist/ for Workers)
- `npm run deploy:{env}` → build + wrangler deploy to Cloudflare
- Wrangler uploads dist/ built by Astro (NOT standalone wrangler dev)
- Entry point: @astrojs/cloudflare/entrypoints/server

GOTCHAS:

- Astro v6 requires excluding @prisma/client/runtime/wasm-compiler-edge from Vite bundling (uses ?module import)
- wrangler.jsonc needs --env flag (development|staging|production) — root config is just structure
- `npm run dev` uses astro dev (NOT wrangler dev) — Astro is the dev server, wrangler is deploy tool
- No migrate:production script — production migrations run via GitHub Actions in parent monorepo
- Fresh clone: npm install → npm run dev:setup (automates DB + migrations + Prisma + typegen)
- worker-configuration.d.ts and generated/prisma/ are gitignored — regenerate on fresh clone
- Prisma migrations: manual workflow (wrangler d1 migrations create → prisma migrate diff → wrangler apply)
- AI content rating: optionally disabled in development, enabled in staging/production (ENABLE_AI_RATING env var)
- Date fields (test_date, created_at): Int (Unix seconds), not DateTime — manual conversion required
