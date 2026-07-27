# @cloudflare/telescope

## 1.2.1

### Patch Changes

- [#336](https://github.com/cloudflare/telescope/pull/336) [`db626bf`](https://github.com/cloudflare/telescope/commit/db626bf5eb3f5e349cb088b529e626c07a41c038) Thanks [@sufian-cf](https://github.com/sufian-cf)! - Bump adm-zip to ^0.6.0 to fix CVE-2026-39244, where a crafted archive declaring
  a huge uncompressed size could force an unbounded Buffer.alloc and exhaust
  memory.

  Also bumps ejs to ^6.0.1 and eslint to ^10.7.0 to clear a transitive
  brace-expansion advisory.

## 1.2.0

### Minor Changes

- [#310](https://github.com/cloudflare/telescope/pull/310) [`9e7f91e`](https://github.com/cloudflare/telescope/commit/9e7f91eb313a20748066daa2ce4aa2bf425e3e72) Thanks [@ozcoder](https://github.com/ozcoder)! - Fetch priority support, added chromium to browser options.

## 1.1.1

### Patch Changes

- [#291](https://github.com/cloudflare/telescope/pull/291) [`815eb9e`](https://github.com/cloudflare/telescope/commit/815eb9e13779dc86ba075d1b6395a308982ff07e) Improvements to CLI parameters

## 1.1.0

### Minor Changes

- [#255](https://github.com/cloudflare/telescope/pull/255) [`80866c1`](https://github.com/cloudflare/telescope/commit/80866c117cff3bd285bf282fbb41dbe3a6d1240f) Initial public release of @cloudflare/telescope.
  - Cross-browser performance testing CLI built on Playwright
  - Programmatic API via `Telescope` class and `launchTest()`
  - HAR, Web Vitals, screenshots, filmstrip, and video collection
  - HTML report generation via the `processors/` entry point
