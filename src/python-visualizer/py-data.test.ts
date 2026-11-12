import { assert } from 'chai';
import sampleFixture from '@/python-visualizer/fixtures/sample.json';
import { deriveVizData, PYTHON_TOKEN_CATEGORY_MAP } from '@/python-visualizer/py-data';
import { TokenCategory } from '@/lox-visualizer/state/token';

describe('PYTHON_TOKEN_CATEGORY_MAP', () => {
    it('maps NAME → IDENTIFIER', () => {
        assert.equal(PYTHON_TOKEN_CATEGORY_MAP['NAME']?.category, TokenCategory.IDENTIFIER);
    });
    it('maps KEYWORD → KEYWORD', () => {
        assert.equal(PYTHON_TOKEN_CATEGORY_MAP['KEYWORD']?.category, TokenCategory.KEYWORD);
    });
    it('maps NUMBER → LITERAL', () => {
        assert.equal(PYTHON_TOKEN_CATEGORY_MAP['NUMBER']?.category, TokenCategory.LITERAL);
    });
    it('maps COMMENT → null', () => {
        assert.isNull(PYTHON_TOKEN_CATEGORY_MAP['COMMENT']?.category);
    });
    it('maps PAREN → PAREN', () => {
        assert.equal(PYTHON_TOKEN_CATEGORY_MAP['PAREN']?.category, TokenCategory.PAREN);
    });
});

describe('deriveVizData() with sample fixture', () => {
    const data = deriveVizData(sampleFixture as any);

    it('produces lexemes', () => {
        assert.isAbove(data.lexemes.length, 0);
    });

    it('gives x (start=0) the IDENTIFIER category', () => {
        const x = data.lexemes.find((l) => l.text === 'x' && l.start === 0);
        assert.isDefined(x);
        assert.equal(x!.category, TokenCategory.IDENTIFIER);
    });

    it('fills whitespace and newline gaps between tokens', () => {
        const joined = data.lexemes.map((l) => l.text).join('');
        assert.equal(joined, sampleFixture.source);
        const newline = data.lexemes.find((l) => l.text === '\n');
        assert.isDefined(newline);
        assert.isNull(newline!.category);
    });

    it('gives + the OPERATOR category', () => {
        const plus = data.lexemes.find((l) => l.text === '+');
        assert.isDefined(plus);
        assert.equal(plus!.category, TokenCategory.OPERATOR);
    });

    it('gives 1 the LITERAL category', () => {
        const one = data.lexemes.find((l) => l.text === '1');
        assert.isDefined(one);
        assert.equal(one!.category, TokenCategory.LITERAL);
    });

    it('produces a <module> chunk', () => {
        assert.isTrue(data.chunks.has('<module>'));
    });

    it('LOAD_CONST at srcOffset 4 (constant-folded 1+2)', () => {
        const instr = data.chunks.get('<module>')!.find(
            (i) => i.op === 'LOAD_CONST' && i.srcOffset === 4,
        );
        assert.isDefined(instr);
    });

    it('STORE_NAME maps to srcOffset 0', () => {
        const instr = data.chunks.get('<module>')!.find((i) => i.op === 'STORE_NAME');
        assert.isDefined(instr);
        assert.equal(instr!.srcOffset, 0);
    });

    it('ast root type is Module', () => {
        assert.equal(data.ast.type, 'Module');
    });

    it('ast has two children (Assign, Expr)', () => {
        assert.equal(data.ast.children.length, 2);
    });
});

describe('deriveVizData() with execution fields', () => {
    it('ignores steps and prints on the raw payload', () => {
        const raw = {
            ...sampleFixture,
            steps: [{
                msg_type: 'vm_step' as const,
                chunk: '<module>',
                offset: 2,
                stack: [{ t: 'num' as const, v: 3 }],
                frames: [{ fn: '<module>', base: 0 }],
            }],
            prints: [{ text: '3', stepIndex: 6, chunk: '<module>', offset: 12 }],
        };
        const data = deriveVizData(raw as any);
        assert.isAbove(data.lexemes.length, 0);
        assert.isTrue(data.chunks.has('<module>'));
    });
});
