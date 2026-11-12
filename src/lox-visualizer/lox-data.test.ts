import { assert } from 'chai';
import { createStore } from '@/lib/store';
import { deriveLoxData, deriveVizData, mapCompilerEvent, mapCompilerChunks, publishConsoleMessages } from '@/lox-visualizer/lox-data';
import type { ConsoleMessage } from '@/lox-visualizer/state/state';
import type { CompilerEvent } from '@/lox-visualizer/events';

describe('deriveVizData()', () => {
    it('is the same function as the deprecated deriveLoxData alias', () => {
        assert.strictEqual(deriveVizData, deriveLoxData);
    });
});

describe('mapCompilerEvent()', () => {
    const fixture: CompilerEvent = {
        msg_type: 'compiler',
        chunk: '<script>',
        offset: 42,
        op: 'OP_ADD',
        line: 3,
        src_offset: 17,
        arg: 2,
        arg_count: 1,
        constant: 'hello',
        jump_target: 55,
    };

    it('maps all fields from CompilerEvent to Instruction', () => {
        const instr = mapCompilerEvent(fixture);
        assert.equal(instr.chunk, '<script>');
        assert.equal(instr.offset, 42);
        assert.equal(instr.op, 'OP_ADD');
        assert.equal(instr.line, 3);
        assert.equal(instr.srcOffset, 17);
        assert.equal(instr.arg, 2);
        assert.equal(instr.argCount, 1);
        assert.equal(instr.constant, 'hello');
        assert.equal(instr.jumpTarget, 55);
    });

    it('maps snake_case fields to camelCase', () => {
        const instr = mapCompilerEvent({ ...fixture, arg_count: 3, jump_target: 99, src_offset: 7 });
        assert.equal(instr.argCount, 3);
        assert.equal(instr.jumpTarget, 99);
        assert.equal(instr.srcOffset, 7);
    });
});

describe('mapCompilerChunks()', () => {
    it('returns an empty map when given an empty map', () => {
        const result = mapCompilerChunks(new Map());
        assert.equal(result.size, 0);
    });

    it('maps each chunk\'s events to Instructions', () => {
        const event: CompilerEvent = {
            msg_type: 'compiler',
            chunk: 'main',
            offset: 0,
            op: 'OP_RETURN',
            line: 1,
            src_offset: 5,
        };
        const result = mapCompilerChunks(new Map([['main', [event]]]));
        assert.equal(result.size, 1);
        assert.equal(result.get('main')![0].srcOffset, 5);
    });
});

describe('publishConsoleMessages()', () => {
    it('notifies subscribers on each in-place append to the source array', () => {
        const source: ConsoleMessage[] = [];
        const store = createStore<{ messages: ConsoleMessage[] }>({ messages: [] });
        const lengths: number[] = [];
        store.subscribe((state) => lengths.push(state.messages.length));

        source.push({ type: 'print', text: 'first' });
        publishConsoleMessages(store, source);
        source.push({ type: 'print', text: 'second' });
        publishConsoleMessages(store, source);

        assert.deepEqual(lengths, [1, 2]);
        assert.deepEqual(store.get().messages, [
            { type: 'print', text: 'first' },
            { type: 'print', text: 'second' },
        ]);
    });
});
