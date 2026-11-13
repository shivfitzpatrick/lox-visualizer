// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

// Source position convention: all start/length values are UTF-16 code-unit
// absolute offsets (JavaScript String indices) into the editor document.
// The Python emitter must flatten (line, col) spans using a line-start table.
// For ASCII source, UTF-8 bytes == UTF-16 code units so there is no difference.

import type { AstNode } from '@/compiler-viz/ast';
import type { TaggedPrint, VmStep } from '@/compiler-viz/execution';
import type { Lexeme, Instruction, VizData } from '@/compiler-viz/types';
import { TokenCategory } from '@/lox-visualizer/state/token';
import type { TokenCategoryMap } from '@/lox-visualizer/token-map';

/** Lexeme as emitted by the Python tokenize script (positions pre-flattened). */
export interface PyRawLexeme {
    tok_name: string;   // tokenize.tok_name value, e.g. 'NAME', 'NUMBER', 'OP'
                        // synthetic: 'KEYWORD', 'PAREN', 'BRACE' for overrides
    text: string;
    start: number;      // absolute UTF-16 offset
    length: number;
}

/** Bytecode instruction as emitted by the Python dis script. */
export interface PyRawInstruction {
    offset: number;         // bytecode offset within the code object
    op: string;             // inst.opname
    arg?: number;           // inst.arg
    constant?: string;      // str(inst.argval) when informative
    src_start?: number;     // flattened col_offset; absent when positions is None
}

/** Top-level JSON shape the Python emitter writes. */
export interface PyRawData {
    source: string;
    lexemes: PyRawLexeme[];
    ast: AstNode;
    chunks: Record<string, PyRawInstruction[]>;
    steps?: VmStep[];
    prints?: TaggedPrint[];
    exec_error?: string;
    steps_capped?: boolean;
    /** @deprecated use prints + executionStore when steps exist */
    console?: Array<{ type: 'print' | 'error'; text: string; src_offset?: number }>;
    error?: string;
}

export const PYTHON_TOKEN_CATEGORY_MAP: TokenCategoryMap = {
    NAME:       { category: TokenCategory.IDENTIFIER },
    KEYWORD:    { category: TokenCategory.KEYWORD },
    NUMBER:     { category: TokenCategory.LITERAL },
    STRING:     { category: TokenCategory.LITERAL },
    FSTRING:    { category: TokenCategory.LITERAL },
    OP:         { category: TokenCategory.OPERATOR },
    PAREN:      { category: TokenCategory.PAREN },
    BRACE:      { category: TokenCategory.BRACE },
    COMMENT:    { category: null },
    NEWLINE:    { category: null },
    NL:         { category: null },
    INDENT:     { category: null },
    DEDENT:     { category: null },
    ENCODING:   { category: null },
    ENDMARKER:  { category: null },
    ERRORTOKEN: { category: null },
};

/** Insert gap lexemes for whitespace/newlines between emitted tokens (matches Lox lex()). */
function fillLexemeGaps(source: string, rawLexemes: PyRawLexeme[]): Lexeme[] {
    const lexemes: Lexeme[] = [];
    let pointer = 0;

    for (const t of rawLexemes) {
        if (t.start > pointer) {
            lexemes.push({
                start: pointer,
                length: t.start - pointer,
                text: source.slice(pointer, t.start),
                category: null,
            });
        }
        pointer = t.start + t.length;
        lexemes.push({
            start: t.start,
            length: t.length,
            text: t.text,
            category: PYTHON_TOKEN_CATEGORY_MAP[t.tok_name]?.category ?? null,
        });
    }

    if (pointer < source.length) {
        lexemes.push({
            start: pointer,
            length: source.length - pointer,
            text: source.slice(pointer),
            category: null,
        });
    }

    return lexemes;
}

export function deriveVizData(raw: PyRawData): VizData {
    const lexemes = fillLexemeGaps(raw.source, raw.lexemes);

    const chunks = new Map<string, Instruction[]>();
    for (const [name, instrs] of Object.entries(raw.chunks)) {
        chunks.set(name, instrs.map((i) => ({
            chunk: name,
            offset: i.offset,
            op: i.op,
            line: 0,         // Python emitter may add later; panels tolerate 0
            srcOffset: i.src_start ?? 0,
            arg: i.arg,
            constant: i.constant,
        })));
    }

    return { lexemes, ast: raw.ast, chunks };
}
