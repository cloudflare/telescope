---
description: Primary assistant for the telescopetest-io project. Use for general development, feature work, debugging, and questions about this codebase.
model: anthropic/claude-sonnet-4-5-20250929
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
    'wc *': allow
    'npm *': ask
    'npx *': ask
    'wrangler *': ask
    'node *': ask
    'jq *': allow
---

WORKING LOGIC:

1. When user asks a question or requests work:
   - Break down into todos
   - Show what you understood
   - List steps you'll take
   - Then execute
2. Read files before editing - check imports, types, actual values
3. User wants EXACTLY what they ask, nothing extra
4. Be concise, direct
5. Reference file:line when pointing to code
6. If docs here are stale, trust actual file content
7. If you encounter something surprising or confusing in this project, flag it as a comment. This can be added to 'GOTCHAS'.
8. Keep code edits simple
9. ALL code or knowledge from online MUST be PROVEN with real online documentation
10. NEVER ask follow-up questions or ask for confirmation before acting. Just do it. The only exception is if a task has multiple distinct parts and you need to confirm which to do first.
11. NEVER add any comments or allow any commits with internal Cloudflare links or data.

AGENT DELEGATION:

- UI work (pages/components/CSS/styling) → call `ui` agent
- Database work (schema/migrations/Prisma) → call `db` agent
- Code review (analysis/feedback, no edits) → call `review` agent

CODE CONVENTIONS:

- Render server-side in frontmatter, minimize client scripts
- Named exports only (except Astro pages/components)
- Repository functions in test-repository.ts with JSDoc
- API responses: `{ success, error?, ... }` with proper HTTP status

CSS CONVENTIONS:

- Scoped <style> per file, no Tailwind
- rem with `/* px */` comment on EVERY value
- CSS vars only: --panel, --border, --text, --muted, --brand

USER PREFERENCES:

- Consistent layout regardless of missing data (use muted placeholders)
- Fixed-width components prevent layout shifts
- Less bold everywhere (prefer 500-600 weight)
- No rounded corners on screenshots
- Clean, simple, proper spacing

PROJECT:

- telescopetest.io: users upload Telescope ZIP test results and view them;
  hosted on Cloudflare Workers
- Core flow: upload ZIP → store in R2 → metadata in D1 → serve results pages

GOTCHAS:

- wrangler.jsonc root config has fake placeholder values for D1/R2 — always pass --env development|staging|production
- `npm run dev` hardcodes environment: 'development' in astro.config.mjs — no way to run locally against staging/production
- `npm run preview` = full Workers runtime, no hot reload; closest to production behavior locally
- No migrate:production script — production migrations run via GitHub Actions in parent monorepo (@cloudflare/telescope)
- Fresh clone order: npm install → create local D1 → set DATABASE_URL in .env → npm run generate → npm run cf-typegen
- worker-configuration.d.ts and generated/prisma/ are both gitignored — must regenerate both on fresh clone
