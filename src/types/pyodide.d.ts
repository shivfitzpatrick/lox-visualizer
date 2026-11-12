declare module 'https://cdn.jsdelivr.net/pyodide/v0.27.5/full/pyodide.mjs' {
    export interface PyodideInterface {
        runPython(code: string): unknown;
        globals: {
            get(name: string): unknown;
            set(name: string, value: unknown): void;
        };
    }
    export function loadPyodide(options?: { indexURL?: string }): Promise<PyodideInterface>;
}

declare module '*.py?raw' {
    const src: string;
    export default src;
}
