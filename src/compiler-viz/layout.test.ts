// @vitest-environment jsdom

import { assert } from 'chai';
import {
    DEFAULT_LAYOUT,
    connectorLinesForLayout,
    kindsInLayout,
    layoutIncludes,
    panelClass,
    panelLabel,
    panelShellId,
    PANEL_LABELS,
    parseDataLayout,
    validateLayout,
} from '@/compiler-viz/layout';

describe('parseDataLayout()', () => {
    it('parses pipe- and comma-separated rows', () => {
        assert.deepEqual(
            parseDataLayout('editor,lexer|ast|playback|bytecode,stack|console'),
            DEFAULT_LAYOUT,
        );
    });

    it('trims whitespace around kinds', () => {
        assert.deepEqual(parseDataLayout(' editor , lexer | ast '), [
            ['editor', 'lexer'],
            ['ast'],
        ]);
    });

    it('validates kinds like validateLayout', () => {
        assert.throws(() => parseDataLayout('editor|editor'), /Duplicate panel kind/);
    });
});

describe('validateLayout()', () => {
    it('returns DEFAULT_LAYOUT unchanged', () => {
        assert.deepEqual(validateLayout(DEFAULT_LAYOUT), DEFAULT_LAYOUT);
    });

    it('skips empty rows', () => {
        assert.deepEqual(
            validateLayout([['editor'], [], ['lexer']]),
            [['editor'], ['lexer']],
        );
    });

    it('throws on duplicate kinds', () => {
        assert.throws(
            () => validateLayout([['lexer'], ['lexer']]),
            /Duplicate panel kind/,
        );
    });

    it('throws on unknown kinds', () => {
        assert.throws(
            () => validateLayout([['editor', 'bogus' as 'editor']]),
            /Unknown panel kind/,
        );
    });
});

describe('kindsInLayout()', () => {
    it('flattens row-major', () => {
        assert.deepEqual(kindsInLayout(DEFAULT_LAYOUT), [
            'editor',
            'lexer',
            'ast',
            'playback',
            'bytecode',
            'stack',
            'console',
        ]);
    });
});

describe('layoutIncludes()', () => {
    it('returns true when kind is present', () => {
        assert.isTrue(layoutIncludes(DEFAULT_LAYOUT, 'ast'));
    });

    it('returns false when kind is absent', () => {
        assert.isFalse(layoutIncludes([['lexer']], 'ast'));
    });
});

describe('panel naming helpers', () => {
    it('panelClass adds lox-panel-- prefix', () => {
        assert.equal(panelClass('lexer'), 'lox-panel--lexer');
    });

    it('panelShellId keeps legacy bytecode id', () => {
        assert.equal(panelShellId('bytecode'), 'lox-compiler');
        assert.equal(panelShellId('lexer'), 'lox-lexer');
    });

    it('panelLabel returns display strings for every kind', () => {
        for (const [kind, label] of Object.entries(PANEL_LABELS)) {
            assert.equal(panelLabel(kind as keyof typeof PANEL_LABELS), label);
        }
        assert.equal(panelLabel('editor'), 'Source');
        assert.equal(panelLabel('ast'), 'Parser');
        assert.equal(panelLabel('console'), 'Output');
        assert.equal(panelLabel('playback'), 'Playback');
    });
});

describe('connectorLinesForLayout()', () => {
    it('registers both lines for DEFAULT_LAYOUT', () => {
        assert.deepEqual(connectorLinesForLayout(DEFAULT_LAYOUT), [
            { from: 'ast', to: 'lexer' },
            { from: 'ast', to: 'bc' },
            { from: 'console', to: 'bc' },
        ]);
    });

    it('omits ast↔lexer when lexer is absent', () => {
        assert.deepEqual(connectorLinesForLayout([['ast'], ['bytecode']]), [
            { from: 'ast', to: 'bc' },
        ]);
    });

    it('registers no lines for lexer-only layout', () => {
        assert.deepEqual(connectorLinesForLayout([['lexer']]), []);
    });
});
