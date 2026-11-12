/** TypeScript resolution stub for the Emscripten bundle (runtime URL is external in Vite). */

interface LoxWasmOptions {
    noInitialRun?: boolean;
    locateFile?: (path: string) => string;
    print?: (text: string) => void;
    printErr?: (text: string) => void;
}

interface LoxWasmModule {
    cwrap(name: string, returnType: string, argTypes: string[]): (...args: unknown[]) => unknown;
}

export default function createLoxWasm(_options?: LoxWasmOptions): Promise<LoxWasmModule> {
    throw new Error('lox-wasm-stub: not loaded at runtime');
}
