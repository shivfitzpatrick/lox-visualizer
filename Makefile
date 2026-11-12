# Path to the clox checkout that builds the WASM module. Override on the
# command line or in the environment if yours lives elsewhere:
#   make wasm LOX_PROJECT=/path/to/clox
LOX_PROJECT ?= $(HOME)/Code/learn/cs/crafting-interpreters/clox
NODE_MODULES := node_modules/.bin
VITE := $(NODE_MODULES)/vite

# Rebuild the clox WASM module and drop the glue + binary where the page
# loads them from (public/ is served at the site root).
wasm:
	$(MAKE) -C $(LOX_PROJECT) wasm
	cp $(LOX_PROJECT)/bin/lox.js public/js/lox-visualizer/lox.js
	cp $(LOX_PROJECT)/bin/lox.wasm public/js/lox-visualizer/lox.wasm

dev:
	$(VITE)

build:
	$(VITE) build

preview: build
	$(VITE) preview

test:
	$(NODE_MODULES)/vitest run

watch:
	$(NODE_MODULES)/vitest

typecheck:
	$(NODE_MODULES)/tsc --noEmit -p tsconfig.app.json
	$(NODE_MODULES)/tsc --noEmit -p tsconfig.test.json

clean:
	rm -rf dist/

.PHONY: wasm dev build preview test watch typecheck clean
