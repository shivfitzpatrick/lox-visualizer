import { LoxState } from '@/lox-visualizer/state/state';
import type { CompilerEvent } from '@/lox-visualizer/events';
import type {
    Instruction,
    VizData,
    VizSelection,
    VizDataStore,
    ConsoleStore,
    ConsoleMessage,
} from '@/compiler-viz/types';

// Re-export canonical types so existing imports from this path keep working.
export type {
    Instruction,
    VizData,
    VizSelection,
    VizDataStore,
    ConsoleStore,
    ConsoleMessage,
} from '@/compiler-viz/types';

/** @deprecated Use VizData */
export type LoxData = VizData;
/** @deprecated Use VizDataStore */
export type LoxDataStore = VizDataStore;
/** @deprecated Use VizSelection */
export type VisualizerSelection = VizSelection;

export function mapCompilerEvent(event: CompilerEvent): Instruction {
    return {
        chunk: event.chunk,
        offset: event.offset,
        op: event.op,
        line: event.line,
        srcOffset: event.src_offset,
        arg: event.arg,
        argCount: event.arg_count,
        constant: event.constant,
        jumpTarget: event.jump_target,
    };
}

export function mapCompilerChunks(
    chunks: Map<string, CompilerEvent[]>,
): Map<string, Instruction[]> {
    const result = new Map<string, Instruction[]>();
    for (const [name, events] of chunks) {
        result.set(name, events.map(mapCompilerEvent));
    }
    return result;
}

export function deriveVizData(state: LoxState): VizData {
    const lexemes = state.lex();
    const ast = state.parse();
    const chunks = mapCompilerChunks(state.compile());
    return { lexemes, ast, chunks };
}

/** @deprecated Use deriveVizData */
export const deriveLoxData = deriveVizData;

// Publish console output to the store. Must copy the array: loxState.push mutates
// consoleMessages in place, and createStore only notifies when a value's
// reference changes — re-setting the same array skips later print lines.
export function publishConsoleMessages(store: ConsoleStore, messages: readonly ConsoleMessage[]): void {
    store.set({ messages: [...messages] });
}
