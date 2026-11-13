// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

export interface LexerEvent {
    msg_type: 'lexer';
    start: number;
    length: number;
    type: number;
}

export const PARSER_ACTIONS = {
    OPEN: 'open',
    CLOSE: 'close',
    ATTR: 'attr',
    PUSHATTR: 'pushattr',
    CHILD_TYPE: 'child_type',
    OPEN_EXPRESSION: 'open_expression',
    CLOSE_EXPRESSION: 'close_expression',
    EXPRESSION_NODE: 'expression_node',
    EXPRESSION_CHILD: 'expression_child',
} as const;

export type ParserAction = (typeof PARSER_ACTIONS)[keyof typeof PARSER_ACTIONS];

export interface ParserEvent {
  msg_type: 'parser';
  start: number;
  action: ParserAction;
  node_type?: string;
  value?: string;
  children?: number;
}

export interface PrintEvent {
    msg_type: 'print';
    text: string;
    chunk?: string;
    offset?: number;
    src_offset?: number;
}

export interface CompilerEvent {
  msg_type: 'compiler';
  chunk: string;
  offset: number;
  op: string;
  line: number;
  src_offset: number;
  arg?: number;
  arg_count?: number;
  constant?: string;
  jump_target?: number;
  upvalues?: Array<{ is_local: boolean; index: number }>;
}
