// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig(({ mode }) => ({
  test: {
    root: resolve(__dirname, 'src'),
    globals: true,
  },

  build: {
    minify: mode === 'production' ? 'terser' : false,
    sourcemap: mode === 'development',

    rollupOptions: {
      // index.html is the entry; it pulls in src/index.ts, which is the only
      // module entry — the visualizer modules are side-effect free and mount
      // on demand. The python-visualizer is not built: it is unpublished work
      // in progress, kept typechecked and tested but out of the bundle.

      // The pyodide entry is dead while the python-visualizer is unbuilt, but
      // it is the setting that keeps the CDN import out of the bundle when it
      // comes back. The Emscripten glue needs no entry here: lox-core imports
      // it by absolute URL at runtime, so it never enters the module graph.
      external: [/^https:\/\/cdn\.jsdelivr\.net\/pyodide\//],
    },
  },

  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
}));
