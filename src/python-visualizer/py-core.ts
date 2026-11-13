// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import type { PyRawData } from '@/python-visualizer/py-data';
import emitterScript from '@/python-visualizer/emitter.py?raw';

const PYODIDE_URL = 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.mjs';

export type PyRunResult =
    | { ok: true; data: PyRawData }
    | { ok: false; error: string };

export interface PyCore {
    run(source: string): PyRunResult;
}

let cached: Promise<PyCore> | null = null;

export function loadPyCore(): Promise<PyCore> {
    if (cached) return cached;

    cached = (async () => {
        const { loadPyodide } = await import(/* @vite-ignore */ PYODIDE_URL);
        const py = await loadPyodide();

        // Inject the emitter into the interpreter once at startup.
        py.runPython(emitterScript);

        return {
            run(source: string): PyRunResult {
                try {
                    py.globals.set('_viz_src', source);
                    const raw = py.runPython(
                        'import json; json.dumps(run(_viz_src))',
                    );
                    const parsed = JSON.parse(raw as string) as PyRawData | { error: string };
                    if ('error' in parsed) {
                        return { ok: false, error: (parsed as { error: string }).error };
                    }
                    return { ok: true, data: parsed as PyRawData };
                } catch (e) {
                    return { ok: false, error: String(e) };
                }
            },
        };
    })();

    return cached;
}
