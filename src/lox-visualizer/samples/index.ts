/// <reference types="vite/client" />
import type { SampleProgram } from '@/compiler-viz/sample-picker';

const modules = import.meta.glob('./*.lox', {
    query: '?raw',
    import: 'default',
}) as Record<string, () => Promise<string>>;

function sample(label: string, file: string): SampleProgram {
    const load = modules[`./${file}`];
    // Glob keys are literal strings, so a renamed file would otherwise
    // surface as a dead dropdown entry; fail at module init instead.
    if (!load) throw new Error(`missing sample: ${file}`);
    return { label, load };
}

// Array, not object: dropdown order is deliberate, not filesystem order.
export const loxSamples: SampleProgram[] = [
    sample('Loop printer', 'loop_printer.lox'),
    sample('Scopes & shadowing', 'scopes.lox'),
    sample('Fibonacci', 'fibonacci.lox'),
    sample('Closures', 'closures.lox'),
    sample('Classes & inheritance', 'inheritance.lox'),
    { label: 'Empty', load: () => Promise.resolve('') },
];

/** The program the editor opens on; the picker starts selected on it. */
export const defaultSample = loxSamples[0];

export const DEFAULT_SAMPLE_LABEL = defaultSample.label;
