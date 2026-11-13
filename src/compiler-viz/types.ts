// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

// Source-position convention: all start/srcOffset values are UTF-16 code unit
// offsets into the editor document string (JavaScript String indexing).
// Language adapters must flatten native spans to this convention before
// publishing VizData.

import type { Store } from '@/lib/store';
import type { AstNode } from '@/compiler-viz/ast';
import type { TokenCategory } from '@/lox-visualizer/state/token';

/** One highlighted source token. Language adapters fill category from their own token map. */
export interface Lexeme {
    start: number;
    length?: number;
    text: string;
    category: TokenCategory | null;
}

/** One bytecode row. Adapter maps platform-specific fields to neutral names. */
export interface Instruction {
    chunk: string;
    offset: number;
    op: string;
    line: number;
    srcOffset: number;
    arg?: number;
    argCount?: number;
    constant?: string;
    jumpTarget?: number;
}

export type ConsoleMessage =
    | { type: 'print'; text: string; chunk?: string; offset?: number; srcOffset?: number }
    | { type: 'error'; text: string };

export interface VizData {
    lexemes: Lexeme[];
    ast: AstNode;
    chunks: Map<string, Instruction[]>;
}

export interface VizSelection {
    selectedStart: number | null;
    selectedAstNode: AstNode | null;
}

export type VizDataStore = Store<{ data: VizData | null }>;
export type ConsoleStore = Store<{ messages: ConsoleMessage[] }>;
