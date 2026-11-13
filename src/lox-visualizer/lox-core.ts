// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import * as d3 from 'd3';
import type { CompilerEvent, LexerEvent, ParserEvent, PrintEvent } from '@/lox-visualizer/events';
import type { VmStep } from '@/compiler-viz/execution';

interface CreateLoxConfig {
    modulePath?: string;
    wasmPath?: string;
}

interface LoxWasmOptions {
    noInitialRun?: boolean;
    locateFile?: (path: string) => string;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
}

interface LoxWasmModule {
    cwrap(name: string, returnType: string, argTypes: string[]): (...args: unknown[]) => unknown;
}

type CreateLoxWasm = (options?: LoxWasmOptions) => Promise<LoxWasmModule>;

export interface LoxEventHandlers {
    stdout: (text: string) => void;
    stderr: (text: string) => void;
    lexer: (event: LexerEvent) => void;
    parser: (event: ParserEvent) => void;
    compiler: (event: CompilerEvent) => void;
    print: (event: PrintEvent) => void;
    session: (event: unknown) => void;
    vm_step: (event: VmStep) => void;
}

export type LoxEvents = {
    on<K extends keyof LoxEventHandlers>(type: K, listener: LoxEventHandlers[K]): void;
};

const baseConfig = {
    modulePath: '/js/lox-visualizer/lox.js',
    wasmPath: '/js/lox-visualizer/lox.wasm',
};

export async function createLox(userConfig: CreateLoxConfig = {}) {
    const config = {
        ...baseConfig,
        ...userConfig,
    };

    const raw = d3.dispatch(
        'stdout',
        'stderr',
        'lexer',
        'parser',
        'compiler',
        'print',
        'session',
        'vm_step',
    );

    const events = raw as unknown as LoxEvents;

    // The Emscripten glue lives in public/ and is copied as-is: it is handed
    // the wasm binary's URL at runtime (see locateFile below), so it has to
    // stay a plain runtime import rather than a module the bundler rewrites.
    // Vite refuses to pull anything under public/ into the module graph, and
    // in dev it appends ?import to any dynamic import whose specifier starts
    // with "." or "/" — which runs into that same refusal. Resolving to an
    // absolute URL avoids both: Vite leaves non-relative specifiers alone, so
    // the browser imports the file straight from the dev server, and from the
    // copied public/ directory in a build. @vite-ignore stops the build from
    // trying to resolve it.
    const moduleUrl = new URL(config.modulePath, import.meta.url).href;
    const { default: createLoxWasm } = (await import(
        /* @vite-ignore */ moduleUrl
    )) as { default: CreateLoxWasm };

    const loxModule = await createLoxWasm({
        noInitialRun: true,
        locateFile(path: string) {
            if (path.endsWith('.wasm')) {
                return config.wasmPath;
            }
            return path;
        },
        print(text: string) {
            if (text.startsWith('{')) {
                const event = JSON.parse(text) as { msg_type: keyof LoxEventHandlers };
                raw.call(event.msg_type, undefined, event);
            }

            raw.call('stdout', undefined, text);
        },
        printErr(text: string) {
            console.error('Lox error:', text);
            raw.call('stderr', undefined, text);
        },
    });

    const runSource = loxModule.cwrap('runSource', 'void', ['string']) as (source: string) => void;

    return {
        loxModule,
        events,
        exports: {
            runSource,
        },
    };
}
