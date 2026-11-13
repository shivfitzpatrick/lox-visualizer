# Lox Compiler Visualizer

An interactive view of how a Lox program is lexed, parsed, compiled to
bytecode, and executed — side by side, with the four representations linked to
each other.

The interpreter underneath is [clox](https://craftinginterpreters.com/), the
bytecode VM from Robert Nystrom's *Crafting Interpreters*, compiled to
WebAssembly and instrumented to emit an event for each lexer token, AST node,
bytecode instruction and VM step. The front end is TypeScript + d3 +
CodeMirror, with no framework.

## What you can do with it

- Type Lox into the editor and click **Build** to lex, parse, compile and run
  it, or pick one of the bundled samples from the dropdown.
- Click any lexer token, AST node or bytecode instruction; the other panels
  highlight the corresponding parts and draw connectors between them.
- Navigate the AST with the arrow keys — left/right for siblings, up for
  parent, down for first child — and drag to pan the tree.
- After a run, scrub or step through execution with the playback bar. The stack
  panel shows the reconstructed evaluation stack at each step, and the console
  panel attributes each line of output to the step that produced it.

## Running it

```sh
npm install
npm run dev        # vite dev server
```

A prebuilt WASM module is committed under `public/js/lox-visualizer/`, so this
is all you need to run the visualizer.

```sh
npm run build      # production bundle into dist/
npm run preview    # serve dist/
npm test           # vitest
npm run typecheck  # tsc, app + tests
```

The `Makefile` wraps the same targets (`make dev`, `make build`, `make test`,
`make typecheck`).

### Rebuilding the WASM module

The WASM module is built from a separate clox checkout — the instrumentation
that feeds the visualizer lives in that C source, not here. With the checkout
in place:

```sh
make wasm LOX_PROJECT=/path/to/clox
```

That runs clox's own `wasm` target and copies `lox.js` + `lox.wasm` into
`public/js/lox-visualizer/`, where the page loads them from.

## Layout

| Path | What it holds |
|---|---|
| `index.html` | The page, and the `#viz-lox-container` mount point |
| `src/index.ts` | Entry point: loads the default sample and mounts the visualizer |
| `src/lox-visualizer/` | Lox specifics — WASM bridge, event types, state derivation, samples |
| `src/compiler-viz/` | Language-agnostic visualizer: panels, layout, connectors, playback |
| `src/lib/` | Small shared primitives — store, component base, style loading |
| `src/python-visualizer/` | Work in progress; typechecked and tested, not in the bundle |
| `public/` | Served at the site root: WASM module, stylesheets, fonts |
| `doc/` | Architecture notes, design docs and development logs (org-mode) |

`src/compiler-viz/` knows nothing about Lox: it renders whatever a language
adapter hands it. `src/lox-visualizer/` is that adapter for Lox, and
`src/python-visualizer/` is an unfinished second one built on Pyodide — kept
typechecked and tested, but deliberately not imported by `src/index.ts`, so it
stays out of the bundle.

## License

Copyright (C) 2026 Siobhan Fitzpatrick.

This program is free software: you can redistribute it and/or modify it under
the terms of the GNU General Public License as published by the Free Software
Foundation, either version 3 of the License, or (at your option) any later
version.

This program is distributed in the hope that it will be useful, but WITHOUT ANY
WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A
PARTICULAR PURPOSE. See the GNU General Public License for more details — a
copy is in [`LICENSE`](LICENSE), and it is also at
<https://www.gnu.org/licenses/>.

## Credits

clox and the Lox language are from *Crafting Interpreters* by Robert Nystrom.
The bundled fonts (Barlow, JetBrains Mono) are under the SIL Open Font License
— see `public/font/OFL.txt`; they are aggregated with this program, not covered
by its license.
