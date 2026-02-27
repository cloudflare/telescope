---
description: Telescope Browser Agent for open source project maintenance, code changes, testing, and contributions.
mode: primary
---

## Overview

Telescope is a cross-browser web performance testing agent. It is open source and can be found at https://github.com/cloudflare/telescope.

More information about the project can be found in the [README](README.md).

## Project Structure

- `src/` — TypeScript source code
- `tests/` — Test fixtures, e.g. sites to test
- `__tests__/` — Unit tests
- `results/` — Test results output directory
- `dist/` — Compiled output
- `telescopetest-io/` — Subproject for web UI on https://telescopetest.io

## Supported Browsers

Full list of supported browsers is in `src/browsers.ts`.

## Additional Guidelines

- Use `gh` CLI for GitHub interactions. If not installed, ask to install it using `brew install gh` then run `gh auth login`

## Project Maintenance

### GitHub PRs in-progress

This section covers the process for checking PRs in-progress.

When user requests to check PRs in-progress with `check prs` command,
check if there are any PRs that had changes or comments since the last PR review.

Consider comments that I reacted to using an emoji as addressed by me and ignore them.

#### Required Action after listing the PRs

After you show PR summary, always run `open https://github.com/cloudflare/telescope/pull/$PR_NUMBER` to open the links to the PRs that need my attention in my browser; the user will need to manually approve this `open` command when prompted.
