---
"@cloudflare/telescope": patch
---

Bump adm-zip to ^0.6.0 to fix CVE-2026-39244, where a crafted archive declaring
a huge uncompressed size could force an unbounded Buffer.alloc and exhaust
memory.

Also bumps ejs to ^6.0.1 and eslint to ^10.7.0 to clear a transitive
brace-expansion advisory.
