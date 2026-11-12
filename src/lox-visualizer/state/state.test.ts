import { assert } from 'chai';
import { TokenCategory } from '@/lox-visualizer/state/token';
import { LoxState, NODE_TYPE, CHILD_TYPE } from '@/lox-visualizer/state/state';
import { collectSubtreeStarts } from '@/compiler-viz/ast';

describe('LoxState.parse()', () => {
    it('empty input returns empty program node', () => {
        const loxState = new LoxState();
        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            attrs: {},
            children: [],
            childType: null,
            start: undefined,
        });
    });

    it('function with empty body', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FUN', start: 0, text: 'fun' },
            { category: null, type: null, start: 3, text: ' ' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'loopPrinter' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 15, text: '(' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 16, text: 'add' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_COMMA', start: 19, text: ',' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 21, text: 'minus' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Function', action: 'open', start: 0 },
            { msg_type: 'parser', node_type: 'Function', action: 'attr', value: 'name', start: 4 },
            { msg_type: 'parser', node_type: 'Function', action: 'pushattr', value: 'params', start: 16 },
            { msg_type: 'parser', node_type: 'Function', action: 'pushattr', value: 'params', start: 21 },
            { msg_type: 'parser', node_type: 'Function', action: 'close', start: 0 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.FUNCTION,
                childType: null,
                attrs: { name: 'loopPrinter', params: ['add', 'minus'] },
                attrStarts: { name: 4, params: [16, 21] },
                start: 0,
                children: [],
            }],
        });
    });

    it('function with print body', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FUN', start: 0, text: 'fun' },
            { category: null, type: null, start: 3, text: ' ' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'loopPrinter' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 15, text: '(' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 16, text: 'add' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_COMMA', start: 19, text: ',' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 21, text: 'minus' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 26, text: ')' },
            { category: TokenCategory.BRACE, type: 'TOKEN_LEFT_BRACE', start: 28, text: '{' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 29, text: 'print' },
            { category: null, type: null, start: 30, text: ' ' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 31, text: '69' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 32, text: ';' },
            { category: TokenCategory.BRACE, type: 'TOKEN_RIGHT_BRACE', start: 33, text: '}' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Function', action: 'open', start: 0 },
            { msg_type: 'parser', node_type: 'Function', action: 'attr', value: 'name', start: 4 },
            { msg_type: 'parser', node_type: 'Function', action: 'pushattr', value: 'params', start: 16 },
            { msg_type: 'parser', node_type: 'Function', action: 'pushattr', value: 'params', start: 21 },
            { msg_type: 'parser', node_type: 'Function', action: 'child_type', value: 'Body', start: 28 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 29 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 32 },
            { msg_type: 'parser', node_type: 'Function', action: 'close', start: 0 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            attrs: {},
            childType: null,
            start: undefined,
            children: [{
                type: NODE_TYPE.FUNCTION,
                childType: null,
                attrs: { name: 'loopPrinter', params: ['add', 'minus'] },
                attrStarts: { name: 4, params: [16, 21] },
                start: 0,
                children: [{
                    type: NODE_TYPE.PRINT,
                    childType: CHILD_TYPE.BODY,
                    attrs: {},
                    start: 29,
                    children: [],
                }],
            }],
        });
    });

    it('expression: 10 + 20 * 2', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 0, text: '10' },
            { category: null, type: null, start: 2, text: ' ' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_PLUS', start: 3, text: '+' },
            { category: null, type: null, start: 4, text: ' ' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 5, text: '20' },
            { category: null, type: null, start: 7, text: ' ' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_STAR', start: 8, text: '*' },
            { category: null, type: null, start: 9, text: ' ' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 10, text: '2' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 5, children: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 10, children: 0 },
            { msg_type: 'parser', node_type: 'Binary', action: 'expression_node', start: 8, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 8 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 8 },
            { msg_type: 'parser', node_type: 'Binary', action: 'expression_node', start: 3, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 3 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 3 },
            { msg_type: 'parser', action: 'close_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 0 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.BINARY,
                    childType: null,
                    attrs: { name: '+' },
                    start: 3,
                    children: [
                        {
                            type: NODE_TYPE.NUMBER,
                            childType: CHILD_TYPE.OPERAND,
                            attrs: { name: '10' },
                            start: 0,
                            children: [],
                        },
                        {
                            type: NODE_TYPE.BINARY,
                            childType: CHILD_TYPE.OPERAND,
                            attrs: { name: '*' },
                            start: 8,
                            children: [
                                { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.OPERAND, attrs: { name: '20' }, start: 5, children: [] },
                                { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.OPERAND, attrs: { name: '2' }, start: 10, children: [] },
                            ],
                        },
                    ],
                }],
            }],
        });
    });

    it('fn call: f(1, 2)', () => {
        // Protocol: arguments are parsed with innerExpression() (no open/close wrappers).
        // Child roles come from expression_child events emitted after the Call expression_node.
        // Call start = position of '(' (parser.previous when call() is invoked).
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'f' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 1, text: '(' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 2, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_COMMA', start: 3, text: ',' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 4, text: '2' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 5, text: ')' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 6, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 2, children: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 4, children: 0 },
            { msg_type: 'parser', node_type: 'Call', action: 'expression_node', start: 1, children: 3 },
            { msg_type: 'parser', action: 'expression_child', value: 'Callee', start: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Argument', start: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Argument', start: 1 },
            { msg_type: 'parser', action: 'close_expression', start: 6 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 6 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.CALL,
                    childType: null,
                    attrs: { name: '(' },
                    start: 1,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.CALLEE, attrs: { name: 'f' }, start: 0, children: [] },
                        { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.ARGUMENT, attrs: { name: '1' }, start: 2, children: [] },
                        { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.ARGUMENT, attrs: { name: '2' }, start: 4, children: [] },
                    ],
                }],
            }],
        });
    });

    it('fn call: f() with no arguments', () => {
        // f(); — Call with 0 args still has 1 child (callee), children = argCount+1 = 1.
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'f' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 1, text: '(' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 2, text: ')' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 3, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Call', action: 'expression_node', start: 1, children: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Callee', start: 1 },
            { msg_type: 'parser', action: 'close_expression', start: 3 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 3 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.CALL,
                    childType: null,
                    attrs: { name: '(' },
                    start: 1,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.CALLEE, attrs: { name: 'f' }, start: 0, children: [] },
                    ],
                }],
            }],
        });
    });

    it('nested fn call: g(f(a))', () => {
        // g(f(a)); — the inner call f(a) appears as an argument to g.
        // All expression_nodes are flat in one expression; expression_child events
        // for each Call follow immediately after that Call's expression_node.
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'g' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 1, text: '(' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 2, text: 'f' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 3, text: '(' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'a' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 5, text: ')' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 6, text: ')' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 7, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 2, children: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 4, children: 0 },
            { msg_type: 'parser', node_type: 'Call', action: 'expression_node', start: 3, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Callee', start: 3 },
            { msg_type: 'parser', action: 'expression_child', value: 'Argument', start: 3 },
            { msg_type: 'parser', node_type: 'Call', action: 'expression_node', start: 1, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Callee', start: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Argument', start: 1 },
            { msg_type: 'parser', action: 'close_expression', start: 7 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 7 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.CALL,
                    childType: null,
                    attrs: { name: '(' },
                    start: 1,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.CALLEE, attrs: { name: 'g' }, start: 0, children: [] },
                        {
                            type: NODE_TYPE.CALL,
                            childType: CHILD_TYPE.ARGUMENT,
                            attrs: { name: '(' },
                            start: 3,
                            children: [
                                { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.CALLEE, attrs: { name: 'f' }, start: 2, children: [] },
                                { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.ARGUMENT, attrs: { name: 'a' }, start: 4, children: [] },
                            ],
                        },
                    ],
                }],
            }],
        });
    });

    it('super call: super.method(a)', () => {
        // namedVariable(syntheticToken("this"/"super")) emits no Variable event,
        // so the stack holds only argument events before the Super node.
        // start = position of the method name identifier.
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_SUPER', start: 0, text: 'super' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_DOT', start: 5, text: '.' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 6, text: 'method' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 12, text: '(' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 13, text: 'a' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 14, text: ')' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 15, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 13, children: 0 },
            { msg_type: 'parser', node_type: 'Super', action: 'expression_node', start: 6, children: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Argument', start: 6 },
            { msg_type: 'parser', action: 'close_expression', start: 15 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 15 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.SUPER,
                    childType: null,
                    attrs: { name: 'method' },
                    start: 6,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.ARGUMENT, attrs: { name: 'a' }, start: 13, children: [] },
                    ],
                }],
            }],
        });
    });

    it('super get: super.prop', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_SUPER', start: 0, text: 'super' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_DOT', start: 5, text: '.' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 6, text: 'prop' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 10, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Super', action: 'expression_node', start: 6, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 10 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 10 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.SUPER,
                    childType: null,
                    attrs: { name: 'prop' },
                    start: 6,
                    children: [],
                }],
            }],
        });
    });

    it('method invocation: obj.method(a, b)', () => {
        // Invoke uses the same child protocol as Call but with Object instead of Callee.
        // start = position of method name (saved in dot() after consuming the identifier).
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'obj' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_DOT', start: 3, text: '.' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'method' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 10, text: '(' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 11, text: 'a' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_COMMA', start: 12, text: ',' },
            { category: null, type: null, start: 13, text: ' ' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 14, text: 'b' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 15, text: ')' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 16, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 11, children: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 14, children: 0 },
            { msg_type: 'parser', node_type: 'Invoke', action: 'expression_node', start: 4, children: 3 },
            { msg_type: 'parser', action: 'expression_child', value: 'Object', start: 4 },
            { msg_type: 'parser', action: 'expression_child', value: 'Argument', start: 4 },
            { msg_type: 'parser', action: 'expression_child', value: 'Argument', start: 4 },
            { msg_type: 'parser', action: 'close_expression', start: 16 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 16 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.INVOKE,
                    childType: null,
                    attrs: { name: 'method' },
                    start: 4,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.OBJECT, attrs: { name: 'obj' }, start: 0, children: [] },
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.ARGUMENT, attrs: { name: 'a' }, start: 11, children: [] },
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.ARGUMENT, attrs: { name: 'b' }, start: 14, children: [] },
                    ],
                }],
            }],
        });
    });

    it('property get: obj.prop', () => {
        // dot() saves start = position of property name (after consuming the identifier).
        // Object events come from parsing 'obj' before dot() fires (infix rule).
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'obj' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_DOT', start: 3, text: '.' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'prop' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 8, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Get', action: 'expression_node', start: 4, children: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Object', start: 4 },
            { msg_type: 'parser', action: 'close_expression', start: 8 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 8 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.GET,
                    childType: null,
                    attrs: { name: 'prop' },
                    start: 4,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.OBJECT, attrs: { name: 'obj' }, start: 0, children: [] },
                    ],
                }],
            }],
        });
    });

    it('property set: obj.prop = 5', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'obj' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_DOT', start: 3, text: '.' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'prop' },
            { category: null, type: null, start: 8, text: ' ' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_EQUAL', start: 9, text: '=' },
            { category: null, type: null, start: 10, text: ' ' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 11, text: '5' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 12, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 11, children: 0 },
            { msg_type: 'parser', node_type: 'Set', action: 'expression_node', start: 4, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Object', start: 4 },
            { msg_type: 'parser', action: 'expression_child', value: 'Value', start: 4 },
            { msg_type: 'parser', action: 'close_expression', start: 12 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 12 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.SET,
                    childType: null,
                    attrs: { name: 'prop' },
                    start: 4,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.OBJECT, attrs: { name: 'obj' }, start: 0, children: [] },
                        { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.VALUE, attrs: { name: '5' }, start: 11, children: [] },
                    ],
                }],
            }],
        });
    });

    it('assignment: a = 5', () => {
        // variable() emits Variable(a) before calling namedVariable.
        // namedVariable then sees '=' and calls innerExpression() for the RHS.
        // Assign node is emitted after the RHS (postfix), with start = position of '='.
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'a' },
            { category: null, type: null, start: 1, text: ' ' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_EQUAL', start: 2, text: '=' },
            { category: null, type: null, start: 3, text: ' ' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 4, text: '5' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 5, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 4, children: 0 },
            { msg_type: 'parser', node_type: 'Assign', action: 'expression_node', start: 2, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Target', start: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Value', start: 2 },
            { msg_type: 'parser', action: 'close_expression', start: 5 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 5 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.ASSIGN,
                    childType: null,
                    attrs: { name: '=' },
                    start: 2,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.TARGET, attrs: { name: 'a' }, start: 0, children: [] },
                        { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.VALUE, attrs: { name: '5' }, start: 4, children: [] },
                    ],
                }],
            }],
        });
    });

    it('logical: a and b', () => {
        // and_ is an infix rule; parser.previous is 'and' when it fires.
        // Left operand events come before and_ is called; right operand events
        // come from parsePrecedence inside and_. Node is emitted last (postfix).
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'a' },
            { category: null, type: null, start: 1, text: ' ' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_AND', start: 2, text: 'and' },
            { category: null, type: null, start: 5, text: ' ' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 6, text: 'b' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 7, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 6, children: 0 },
            { msg_type: 'parser', node_type: 'Binary', action: 'expression_node', start: 2, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 2 },
            { msg_type: 'parser', action: 'close_expression', start: 7 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 7 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.BINARY,
                    childType: null,
                    attrs: { name: 'and' },
                    start: 2,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.OPERAND, attrs: { name: 'a' }, start: 0, children: [] },
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.OPERAND, attrs: { name: 'b' }, start: 6, children: [] },
                    ],
                }],
            }],
        });
    });

    it('logical: a or b', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 0, text: 'a' },
            { category: null, type: null, start: 1, text: ' ' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_OR', start: 2, text: 'or' },
            { category: null, type: null, start: 4, text: ' ' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 5, text: 'b' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 6, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 5, children: 0 },
            { msg_type: 'parser', node_type: 'Binary', action: 'expression_node', start: 2, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 2 },
            { msg_type: 'parser', action: 'close_expression', start: 6 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 6 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.BINARY,
                    childType: null,
                    attrs: { name: 'or' },
                    start: 2,
                    children: [
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.OPERAND, attrs: { name: 'a' }, start: 0, children: [] },
                        { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.OPERAND, attrs: { name: 'b' }, start: 5, children: [] },
                    ],
                }],
            }],
        });
    });

    it('literal: true', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_TRUE', start: 0, text: 'true' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 4, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Literal', action: 'expression_node', start: 0, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 4 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 4 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.LITERAL,
                    childType: null,
                    attrs: { name: 'true' },
                    start: 0,
                    children: [],
                }],
            }],
        });
    });

    it('unary: !true (literal operand)', () => {
        // Key case: Unary's operand is a literal, which now emits a Literal event.
        // Before literal support, the Unary appeared with no children in the tree.
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.OPERATOR, type: 'TOKEN_BANG', start: 0, text: '!' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_TRUE', start: 1, text: 'true' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 5, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Literal', action: 'expression_node', start: 1, children: 0 },
            { msg_type: 'parser', node_type: 'Unary', action: 'expression_node', start: 0, children: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 5 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 5 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.UNARY,
                    childType: null,
                    attrs: { name: '!' },
                    start: 0,
                    children: [
                        { type: NODE_TYPE.LITERAL, childType: CHILD_TYPE.OPERAND, attrs: { name: 'true' }, start: 1, children: [] },
                    ],
                }],
            }],
        });
    });

    it('unary: -5', () => {
        // Unary postfix: operand emitted first, then Unary node + expression_child.
        // Unary start = position of the operator token (saved before parsePrecedence).
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.OPERATOR, type: 'TOKEN_MINUS', start: 0, text: '-' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 1, text: '5' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 2, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 1, children: 0 },
            { msg_type: 'parser', node_type: 'Unary', action: 'expression_node', start: 0, children: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 2 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 2 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.UNARY,
                    childType: null,
                    attrs: { name: '-' },
                    start: 0,
                    children: [
                        { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.OPERAND, attrs: { name: '5' }, start: 1, children: [] },
                    ],
                }],
            }],
        });
    });

    it('class declaration: class Dog {}', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_CLASS', start: 0, text: 'class' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 6, text: 'Dog' },
            { category: TokenCategory.BRACE, type: 'TOKEN_RIGHT_BRACE', start: 10, text: '}' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Class', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'attr', value: 'name', start: 6 },
            { msg_type: 'parser', node_type: 'Class', action: 'close', start: 10 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.CLASS,
                childType: null,
                attrs: { name: 'Dog' },
                attrStarts: { name: 6 },
                start: 0,
                children: [],
            }],
        });
    });

    it('class declaration with superclass and method: class Dog < Animal { bark() {} }', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_CLASS', start: 0, text: 'class' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 6, text: 'Dog' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 12, text: 'Animal' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 21, text: 'bark' },
            { category: TokenCategory.BRACE, type: 'TOKEN_RIGHT_BRACE', start: 29, text: '}' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Class', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'attr', value: 'name', start: 6 },
            { msg_type: 'parser', action: 'child_type', value: 'Superclass', start: 12 },
            { msg_type: 'parser', action: 'open_expression', start: 12 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 12, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 19 },
            { msg_type: 'parser', action: 'child_type', value: 'Method', start: 21 },
            { msg_type: 'parser', node_type: 'Method', action: 'open', start: 21 },
            { msg_type: 'parser', action: 'attr', value: 'name', start: 21 },
            { msg_type: 'parser', action: 'child_type', value: 'Body', start: 28 },
            { msg_type: 'parser', node_type: 'Method', action: 'close', start: 29 },
            { msg_type: 'parser', node_type: 'Class', action: 'close', start: 29 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.CLASS,
                childType: null,
                attrs: { name: 'Dog' },
                attrStarts: { name: 6 },
                start: 0,
                children: [
                    { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.SUPERCLASS, attrs: { name: 'Animal' }, start: 12, children: [] },
                    { type: NODE_TYPE.METHOD, childType: CHILD_TYPE.METHOD, attrs: { name: 'bark' }, attrStarts: { name: 21 }, start: 21, children: [] },
                ],
            }],
        });
    });

    it('var declaration with initializer: var x = 1;', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_VAR', start: 0, text: 'var' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'x' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_EQUAL', start: 6, text: '=' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 8, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 9, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Var', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'attr', value: 'name', start: 4 },
            { msg_type: 'parser', action: 'child_type', value: 'Initializer', start: 8 },
            { msg_type: 'parser', action: 'open_expression', start: 8 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 8, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 9 },
            { msg_type: 'parser', node_type: 'Var', action: 'close', start: 9 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.VAR,
                childType: null,
                attrs: { name: 'x' },
                attrStarts: { name: 4 },
                start: 0,
                children: [
                    { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.INITIALIZER, attrs: { name: '1' }, start: 8, children: [] },
                ],
            }],
        });
    });

    it('return with value: fun f() { return 1; }', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FUN', start: 0, text: 'fun' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'f' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 12, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 13, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Function', action: 'open', start: 0 },
            { msg_type: 'parser', node_type: 'Function', action: 'attr', value: 'name', start: 4 },
            { msg_type: 'parser', action: 'child_type', value: 'Body', start: 8 },
            { msg_type: 'parser', node_type: 'Return', action: 'open', start: 8 },
            { msg_type: 'parser', action: 'child_type', value: 'Value', start: 12 },
            { msg_type: 'parser', action: 'open_expression', start: 12 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 12, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 13 },
            { msg_type: 'parser', node_type: 'Return', action: 'close', start: 13 },
            { msg_type: 'parser', node_type: 'Function', action: 'close', start: 13 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.FUNCTION,
                childType: null,
                attrs: { name: 'f' },
                attrStarts: { name: 4 },
                start: 0,
                children: [{
                    type: NODE_TYPE.RETURN,
                    childType: CHILD_TYPE.BODY,
                    attrs: {},
                    start: 8,
                    children: [
                        { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.VALUE, attrs: { name: '1' }, start: 12, children: [] },
                    ],
                }],
            }],
        });
    });

    it('switch (x) { case 1: print 1; default: print 2; }', () => {
        // Discriminant x; case value 1 with Print body; default with Print body.
        // child_type 'CaseBody'/'Default' applies to the first (only) statement
        // in each branch since childType persists until the next child_type event.
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_SWITCH', start: 0, text: 'switch' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 8, text: 'x' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 16, text: '1' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 19, text: 'print' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 25, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 26, text: ';' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 37, text: 'print' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 43, text: '2' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 44, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Switch', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'child_type', value: 'Discriminant', start: 8 },
            { msg_type: 'parser', action: 'open_expression', start: 8 },
            { msg_type: 'parser', node_type: 'Variable', action: 'expression_node', start: 8, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 15 },
            { msg_type: 'parser', action: 'child_type', value: 'Case', start: 16 },
            { msg_type: 'parser', action: 'open_expression', start: 16 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 16, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 18 },
            { msg_type: 'parser', action: 'child_type', value: 'CaseBody', start: 19 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 19 },
            { msg_type: 'parser', action: 'open_expression', start: 25 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 25, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 26 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 26 },
            { msg_type: 'parser', action: 'child_type', value: 'Default', start: 37 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 37 },
            { msg_type: 'parser', action: 'open_expression', start: 43 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 43, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 44 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 44 },
            { msg_type: 'parser', node_type: 'Switch', action: 'close', start: 44 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.SWITCH,
                childType: null,
                attrs: {},
                start: 0,
                children: [
                    { type: NODE_TYPE.VARIABLE, childType: CHILD_TYPE.DISCRIMINANT, attrs: { name: 'x' }, start: 8, children: [] },
                    { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.CASE, attrs: { name: '1' }, start: 16, children: [] },
                    {
                        type: NODE_TYPE.PRINT,
                        childType: CHILD_TYPE.CASEBODY,
                        attrs: {},
                        start: 19,
                        children: [
                            { type: NODE_TYPE.NUMBER, childType: null, attrs: { name: '1' }, start: 25, children: [] },
                        ],
                    },
                    {
                        type: NODE_TYPE.PRINT,
                        childType: CHILD_TYPE.DEFAULT,
                        attrs: {},
                        start: 37,
                        children: [
                            { type: NODE_TYPE.NUMBER, childType: null, attrs: { name: '2' }, start: 43, children: [] },
                        ],
                    },
                ],
            }],
        });
    });

    it('while (true) print 1;', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_WHILE', start: 0, text: 'while' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_TRUE', start: 7, text: 'true' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 13, text: 'print' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 19, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 20, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'While', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'child_type', value: 'Condition', start: 7 },
            { msg_type: 'parser', action: 'open_expression', start: 7 },
            { msg_type: 'parser', node_type: 'Literal', action: 'expression_node', start: 7, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 12 },
            { msg_type: 'parser', action: 'child_type', value: 'Body', start: 13 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 13 },
            { msg_type: 'parser', action: 'open_expression', start: 19 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 19, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 20 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 20 },
            { msg_type: 'parser', node_type: 'While', action: 'close', start: 20 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.WHILE,
                childType: null,
                attrs: {},
                start: 0,
                children: [
                    { type: NODE_TYPE.LITERAL, childType: CHILD_TYPE.CONDITION, attrs: { name: 'true' }, start: 7, children: [] },
                    {
                        type: NODE_TYPE.PRINT,
                        childType: CHILD_TYPE.BODY,
                        attrs: {},
                        start: 13,
                        children: [
                            { type: NODE_TYPE.NUMBER, childType: null, attrs: { name: '1' }, start: 19, children: [] },
                        ],
                    },
                ],
            }],
        });
    });

    it('for (;;) print 1; — body only', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FOR', start: 0, text: 'for' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 7, text: 'print' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 13, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 14, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'For', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'child_type', value: 'Body', start: 7 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 7 },
            { msg_type: 'parser', action: 'open_expression', start: 13 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 13, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 14 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 14 },
            { msg_type: 'parser', node_type: 'For', action: 'close', start: 14 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.FOR,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.PRINT,
                    childType: CHILD_TYPE.BODY,
                    attrs: {},
                    start: 7,
                    children: [
                        { type: NODE_TYPE.NUMBER, childType: null, attrs: { name: '1' }, start: 13, children: [] },
                    ],
                }],
            }],
        });
    });

    it('for (; true;) print 1; — condition + body', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FOR', start: 0, text: 'for' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_TRUE', start: 5, text: 'true' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 12, text: 'print' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 18, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 19, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'For', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'child_type', value: 'Condition', start: 5 },
            { msg_type: 'parser', action: 'open_expression', start: 5 },
            { msg_type: 'parser', node_type: 'Literal', action: 'expression_node', start: 5, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 11 },
            { msg_type: 'parser', action: 'child_type', value: 'Body', start: 12 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 12 },
            { msg_type: 'parser', action: 'open_expression', start: 18 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 18, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 19 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 19 },
            { msg_type: 'parser', node_type: 'For', action: 'close', start: 19 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.FOR,
                childType: null,
                attrs: {},
                start: 0,
                children: [
                    { type: NODE_TYPE.LITERAL, childType: CHILD_TYPE.CONDITION, attrs: { name: 'true' }, start: 5, children: [] },
                    {
                        type: NODE_TYPE.PRINT,
                        childType: CHILD_TYPE.BODY,
                        attrs: {},
                        start: 12,
                        children: [
                            { type: NODE_TYPE.NUMBER, childType: null, attrs: { name: '1' }, start: 18, children: [] },
                        ],
                    },
                ],
            }],
        });
    });

    it('if-then: if (true) print 1;', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_IF', start: 0, text: 'if' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 3, text: '(' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_TRUE', start: 4, text: 'true' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 8, text: ')' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 10, text: 'print' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 16, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 17, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'If', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'child_type', value: 'Condition', start: 4 },
            { msg_type: 'parser', action: 'open_expression', start: 4 },
            { msg_type: 'parser', node_type: 'Literal', action: 'expression_node', start: 4, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 8 },
            { msg_type: 'parser', action: 'child_type', value: 'Then', start: 10 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 10 },
            { msg_type: 'parser', action: 'open_expression', start: 16 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 16, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 17 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 17 },
            { msg_type: 'parser', node_type: 'If', action: 'close', start: 17 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.IF,
                childType: null,
                attrs: {},
                start: 0,
                children: [
                    { type: NODE_TYPE.LITERAL, childType: CHILD_TYPE.CONDITION, attrs: { name: 'true' }, start: 4, children: [] },
                    {
                        type: NODE_TYPE.PRINT,
                        childType: CHILD_TYPE.THEN,
                        attrs: {},
                        start: 10,
                        children: [
                            { type: NODE_TYPE.NUMBER, childType: null, attrs: { name: '1' }, start: 16, children: [] },
                        ],
                    },
                ],
            }],
        });
    });

    it('if-then-else: if (true) print 1; else print 2;', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_IF', start: 0, text: 'if' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 3, text: '(' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_TRUE', start: 4, text: 'true' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 8, text: ')' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 10, text: 'print' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 16, text: '1' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 17, text: ';' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_ELSE', start: 19, text: 'else' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 24, text: 'print' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 30, text: '2' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 31, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'If', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'child_type', value: 'Condition', start: 4 },
            { msg_type: 'parser', action: 'open_expression', start: 4 },
            { msg_type: 'parser', node_type: 'Literal', action: 'expression_node', start: 4, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 8 },
            { msg_type: 'parser', action: 'child_type', value: 'Then', start: 10 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 10 },
            { msg_type: 'parser', action: 'open_expression', start: 16 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 16, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 17 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 17 },
            { msg_type: 'parser', action: 'child_type', value: 'Else', start: 24 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 24 },
            { msg_type: 'parser', action: 'open_expression', start: 30 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 30, children: 0 },
            { msg_type: 'parser', action: 'close_expression', start: 31 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 31 },
            { msg_type: 'parser', node_type: 'If', action: 'close', start: 31 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.IF,
                childType: null,
                attrs: {},
                start: 0,
                children: [
                    { type: NODE_TYPE.LITERAL, childType: CHILD_TYPE.CONDITION, attrs: { name: 'true' }, start: 4, children: [] },
                    {
                        type: NODE_TYPE.PRINT,
                        childType: CHILD_TYPE.THEN,
                        attrs: {},
                        start: 10,
                        children: [
                            { type: NODE_TYPE.NUMBER, childType: null, attrs: { name: '1' }, start: 16, children: [] },
                        ],
                    },
                    {
                        type: NODE_TYPE.PRINT,
                        childType: CHILD_TYPE.ELSE,
                        attrs: {},
                        start: 24,
                        children: [
                            { type: NODE_TYPE.NUMBER, childType: null, attrs: { name: '2' }, start: 30, children: [] },
                        ],
                    },
                ],
            }],
        });
    });

    it('grouping: (1 + 2) * 3', () => {
        // Grouping postfix: inner expression events come first, then Grouping node + expression_child.
        // Grouping start = position of '(' (parser.previous when grouping() is invoked).
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 0, text: '(' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 1, text: '1' },
            { category: null, type: null, start: 2, text: ' ' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_PLUS', start: 3, text: '+' },
            { category: null, type: null, start: 4, text: ' ' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 5, text: '2' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 6, text: ')' },
            { category: null, type: null, start: 7, text: ' ' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_STAR', start: 8, text: '*' },
            { category: null, type: null, start: 9, text: ' ' },
            { category: TokenCategory.LITERAL, type: 'TOKEN_NUMBER', start: 10, text: '3' },
            { category: TokenCategory.OPERATOR, type: 'TOKEN_SEMICOLON', start: 11, text: ';' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Expression', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'open_expression', start: 0 },
            // inner Binary(+): children emitted first (postfix)
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 1, children: 0 },
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 5, children: 0 },
            { msg_type: 'parser', node_type: 'Binary', action: 'expression_node', start: 3, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 3 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 3 },
            // Grouping wraps the Binary(+)
            { msg_type: 'parser', node_type: 'Grouping', action: 'expression_node', start: 0, children: 1 },
            { msg_type: 'parser', action: 'expression_child', value: 'Expression', start: 0 },
            // outer Binary(*): right operand, then Binary(*) node
            { msg_type: 'parser', node_type: 'Number', action: 'expression_node', start: 10, children: 0 },
            { msg_type: 'parser', node_type: 'Binary', action: 'expression_node', start: 8, children: 2 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 8 },
            { msg_type: 'parser', action: 'expression_child', value: 'Operand', start: 8 },
            { msg_type: 'parser', action: 'close_expression', start: 11 },
            { msg_type: 'parser', node_type: 'Expression', action: 'close', start: 11 },
        ]);

        const root = loxState.parse();

        assert.deepEqual(root, {
            type: NODE_TYPE.PROGRAM,
            childType: null,
            attrs: {},
            start: undefined,
            children: [{
                type: NODE_TYPE.EXPRESSION,
                childType: null,
                attrs: {},
                start: 0,
                children: [{
                    type: NODE_TYPE.BINARY,
                    childType: null,
                    attrs: { name: '*' },
                    start: 8,
                    children: [
                        {
                            type: NODE_TYPE.GROUPING,
                            childType: CHILD_TYPE.OPERAND,
                            attrs: { name: '(' },
                            start: 0,
                            children: [{
                                type: NODE_TYPE.BINARY,
                                childType: CHILD_TYPE.EXPRESSION,
                                attrs: { name: '+' },
                                start: 3,
                                children: [
                                    { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.OPERAND, attrs: { name: '1' }, start: 1, children: [] },
                                    { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.OPERAND, attrs: { name: '2' }, start: 5, children: [] },
                                ],
                            }],
                        },
                        { type: NODE_TYPE.NUMBER, childType: CHILD_TYPE.OPERAND, attrs: { name: '3' }, start: 10, children: [] },
                    ],
                }],
            }],
        });
    });
});

describe('collectSubtreeStarts()', () => {
    it('includes ATTR and PUSHATTR offsets on declaration nodes', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FUN', start: 0, text: 'fun' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'f' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 5, text: '(' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 6, text: 'a' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_COMMA', start: 7, text: ',' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 8, text: 'b' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 9, text: ')' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Function', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'attr', value: 'name', start: 4 },
            { msg_type: 'parser', action: 'pushattr', value: 'params', start: 6 },
            { msg_type: 'parser', action: 'pushattr', value: 'params', start: 8 },
            { msg_type: 'parser', node_type: 'Function', action: 'close', start: 9 },
        ]);

        const fn = loxState.parse().children[0];
        assert.deepEqual(collectSubtreeStarts(fn).sort((a, b) => a - b), [0, 4, 6, 8]);
    });
});
