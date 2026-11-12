import { assert } from 'chai';
import { findNodeForOffset, adjacentNode } from '@/compiler-viz/ast';
import type { AstNode } from '@/compiler-viz/ast';
import { hierarchy, tree } from 'd3';
import { TokenCategory } from '@/lox-visualizer/state/token';
import { LoxState, NODE_TYPE } from '@/lox-visualizer/state/state';

describe('findNodeForOffset()', () => {
    it('resolves function keyword to the Function node', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FUN', start: 0, text: 'fun' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'f' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Function', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'attr', value: 'name', start: 4 },
            { msg_type: 'parser', node_type: 'Function', action: 'close', start: 0 },
        ]);

        const root = loxState.parse();
        const fn = root.children[0];
        assert.equal(findNodeForOffset(root, 0)?.type, NODE_TYPE.FUNCTION);
        assert.strictEqual(findNodeForOffset(root, 0), fn);
    });

    it('resolves function name and params to the Function node', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FUN', start: 0, text: 'fun' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'loopPrinter' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 15, text: '(' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 16, text: 'add' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_COMMA', start: 19, text: ',' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 21, text: 'minus' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 26, text: ')' },
            { category: TokenCategory.BRACE, type: 'TOKEN_LEFT_BRACE', start: 28, text: '{' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 29, text: 'print' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Function', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'attr', value: 'name', start: 4 },
            { msg_type: 'parser', action: 'pushattr', value: 'params', start: 16 },
            { msg_type: 'parser', action: 'pushattr', value: 'params', start: 21 },
            { msg_type: 'parser', action: 'child_type', value: 'Body', start: 28 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 29 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 29 },
            { msg_type: 'parser', node_type: 'Function', action: 'close', start: 0 },
        ]);

        const root = loxState.parse();
        const fn = root.children[0];

        for (const offset of [4, 16, 21]) {
            assert.strictEqual(findNodeForOffset(root, offset), fn, `offset ${offset}`);
        }
    });

    it('resolves declaration punctuation before the body to the Function node', () => {
        const loxState = new LoxState();
        loxState.set('lexemes', [
            { category: TokenCategory.KEYWORD, type: 'TOKEN_FUN', start: 0, text: 'fun' },
            { category: TokenCategory.IDENTIFIER, type: 'TOKEN_IDENTIFIER', start: 4, text: 'f' },
            { category: TokenCategory.PAREN, type: 'TOKEN_LEFT_PAREN', start: 5, text: '(' },
            { category: TokenCategory.PAREN, type: 'TOKEN_RIGHT_PAREN', start: 6, text: ')' },
            { category: TokenCategory.BRACE, type: 'TOKEN_LEFT_BRACE', start: 8, text: '{' },
            { category: TokenCategory.KEYWORD, type: 'TOKEN_PRINT', start: 9, text: 'print' },
        ]);
        loxState.set('parserEvents', [
            { msg_type: 'parser', node_type: 'Function', action: 'open', start: 0 },
            { msg_type: 'parser', action: 'attr', value: 'name', start: 4 },
            { msg_type: 'parser', action: 'child_type', value: 'Body', start: 8 },
            { msg_type: 'parser', node_type: 'Print', action: 'open', start: 9 },
            { msg_type: 'parser', node_type: 'Print', action: 'close', start: 9 },
            { msg_type: 'parser', node_type: 'Function', action: 'close', start: 0 },
        ]);

        const root = loxState.parse();
        const fn = root.children[0];

        for (const offset of [5, 6, 8]) {
            assert.strictEqual(findNodeForOffset(root, offset), fn, `offset ${offset}`);
        }
        assert.equal(findNodeForOffset(root, 9)?.type, NODE_TYPE.PRINT);
    });
});

describe('adjacentNode()', () => {
    // Build a small fixed tree:
    //
    //        Program
    //       /       \
    //    Print      Var
    //      |
    //   Literal
    //
    function makeTree() {
        const data: AstNode = {
            type: 'Program',
            childType: null,
            attrs: {},
            children: [
                {
                    type: 'Print',
                    childType: 'first',
                    attrs: {},
                    children: [
                        { type: 'Literal', childType: 'expr', attrs: {}, children: [] },
                    ],
                },
                { type: 'Var', childType: 'second', attrs: {}, children: [] },
            ],
        };
        const root = hierarchy(data);
        tree<AstNode>().nodeSize([200, 100])(root);
        return root;
    }

    it('moves right to next sibling', () => {
        const root = makeTree();
        const print = root.children![0];
        const varNode = root.children![1];
        assert.strictEqual(adjacentNode(root, print, 'right'), varNode);
    });

    it('moves left to previous sibling', () => {
        const root = makeTree();
        const print = root.children![0];
        const varNode = root.children![1];
        assert.strictEqual(adjacentNode(root, varNode, 'left'), print);
    });

    it('moves up to parent', () => {
        const root = makeTree();
        const print = root.children![0];
        assert.strictEqual(adjacentNode(root, print, 'up'), root);
    });

    it('moves down to first child', () => {
        const root = makeTree();
        const print = root.children![0];
        const literal = print.children![0];
        assert.strictEqual(adjacentNode(root, print, 'down'), literal);
    });

    it('returns null at tree boundaries', () => {
        const root = makeTree();
        const varNode = root.children![1];
        const literal = root.children![0].children![0];
        assert.isNull(adjacentNode(root, root, 'up'));
        assert.isNull(adjacentNode(root, varNode, 'right'));
        assert.isNull(adjacentNode(root, literal, 'down'));
    });
});
