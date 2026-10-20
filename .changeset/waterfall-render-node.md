---
"@cloudflare/waterfall": patch
---

Export `renderToHTML()` from `@cloudflare/waterfall/render` so Node.js build
scripts can render a HAR without a CSS loader or DOM shims. The main entry
point imports `waterfall.css` and defines a custom element, so it only loads
in a bundler or a browser.
