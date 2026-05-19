import { defineConfig } from 'vite';
import { resolve } from 'path';

const __dirname = new URL('.', import.meta.url).pathname;

/**
 * Library-mode build for drop-in consumers.
 *
 * Produces:
 *   dist/waterfall.js       Single self-contained ES module that registers
 *                           the <waterfall-chart> custom element.
 *   dist/waterfall.js.map   Source map for the bundle.
 *   dist/waterfall.css      Stylesheet (emitted because src/index.ts imports
 *                           ./waterfall.css).
 *
 * Run AFTER `tsc` so per-module .js/.d.ts output for bundler consumers is
 * preserved (emptyOutDir: false).
 */
export default defineConfig({
  // Disable the default publicDir ('<root>/public'); otherwise Vite would copy
  // demo assets (index.html, theme.js, demo.har, …) into dist/.
  publicDir: false,
  build: {
    outDir: 'dist',
    emptyOutDir: false,
    sourcemap: true,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: () => 'waterfall.js',
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'waterfall.css',
      },
    },
  },
});
