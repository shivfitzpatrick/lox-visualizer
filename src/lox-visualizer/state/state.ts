// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { TokenType, TokenCategory } from '@/lox-visualizer/state/token';
import { LOX_TOKEN_CATEGORY_MAP } from '@/lox-visualizer/token-map';
import { AstNode } from '@/compiler-viz/ast';
import { LexerEvent, ParserEvent, CompilerEvent, PARSER_ACTIONS } from '@/lox-visualizer/events';

export { PARSER_ACTIONS } from '@/lox-visualizer/events';
export type { ParserAction } from '@/lox-visualizer/events';

export interface Lexeme {
    text: string;
    type: keyof typeof TokenType | null;
    category: TokenCategory | null;
    start: number;
    length?: number;
}

import type { ConsoleMessage } from '@/compiler-viz/types';
export type { ConsoleMessage };

abstract class State<T extends Record<string, unknown>> {
    abstract props: T;

    get<K extends keyof T>(name: K): T[K] {
	return this.props[name];
    }

    set<K extends keyof T>(name: K, value: T[K]): T[K] {
	return this.props[name] = value;
    }

    push<K extends keyof T>(name: K, value: T[K] extends unknown[] ? T[K][number] : never): void {
	(this.props[name] as unknown[]).push(value);
    }

    emptyArray<K extends keyof T>(name: K): void {
	this.props[name] = [] as unknown as T[K];
    }

    emptyDict<K extends keyof T>(name: K): void {
	this.props[name] = {} as unknown as T[K];
    }
}

export function mapTokenType(type: number): keyof typeof TokenType {
    const name = TokenType[type] as keyof typeof TokenType | undefined;
    if (name === undefined) throw new Error(`Unknown token type: ${type}`);
    return name;
}

function mapToken(lexerEvent: LexerEvent) {
    const type = mapTokenType(lexerEvent.type);

    return {
	type,
	start: lexerEvent.start,
	length: lexerEvent.length,
	...LOX_TOKEN_CATEGORY_MAP[type],
    };
}

export const NODE_TYPE = {
    ASSIGN: 'Assign',
    BINARY: 'Binary',
    CALL: 'Call',
    CLASS: 'Class',
    FOR: 'For',
    GET: 'Get',
    INVOKE: 'Invoke',
    EXPRESSION: 'Expression',
    FUNCTION: 'Function',
    GROUPING: 'Grouping',
    IF: 'If',
    LITERAL: 'Literal',
    METHOD: 'Method',
    NUMBER: 'Number',
    PRINT: 'Print',
    PROGRAM: 'Program',
    RETURN: 'Return',
    SET: 'Set',
    SUPER: 'Super',
    SWITCH: 'Switch',
    UNARY: 'Unary',
    VAL: 'Val',
    VAR: 'Var',
    VARIABLE: 'Variable',
    WHILE: 'While',
} as const;

export type NodeType = (typeof NODE_TYPE)[keyof typeof NODE_TYPE];

export const CHILD_TYPE = {
    ARGUMENT: 'Argument',
    BODY: 'Body',
    CALLEE: 'Callee',
    CASE: 'Case',
    CASEBODY: 'CaseBody',
    CONDITION: 'Condition',
    DEFAULT: 'Default',
    DISCRIMINANT: 'Discriminant',
    ELSE: 'Else',
    EXPRESSION: 'Expression',
    INCREMENT: 'Increment',
    INITIALIZER: 'Initializer',
    METHOD: 'Method',
    OBJECT: 'Object',
    OPERAND: 'Operand',
    SUPERCLASS: 'Superclass',
    TARGET: 'Target',
    THEN: 'Then',
    VALUE: 'Value',
} as const;

export type ChildTypeName = (typeof CHILD_TYPE)[keyof typeof CHILD_TYPE];

function createNode(type: string | null | undefined, childType: string | null = null, start?: number): AstNode {
    return {
        type: type || '',
	childType,
	start,
	attrs: {},
	children: [],
    };
}

interface ExtendedParserEvent extends ParserEvent {
  childNodes: string[];
  isNode: false;
}

type ParseExpressionNode = ExtendedParserEvent | AstNode;

function parseExpressionNode({
  nodes,
  lexemeMap,
  childType,
}: {
  nodes: ParseExpressionNode[],
  lexemeMap: Record<number, Lexeme>
  childType: string | null | undefined,
}) {
  const top = nodes.pop();
  if (!top) return top;

  if (!('action' in top)) {
    if (childType != null) (top as AstNode).childType = childType;
    return top as AstNode;
  }

  const rootEvent = top as ExtendedParserEvent;
  const rootNode = createNode(rootEvent.node_type, childType, rootEvent.start);

  try {
    rootNode.attrs.name = lexemeMap[rootEvent.start].text;
  } catch (e) { console.error(e); }

  const numChildren = rootEvent.children ?? 0;
  const childNodes = rootEvent.childNodes ?? [];

  for (let i = 0; i < numChildren && nodes.length > 0; i++) {
    const childChildType = childNodes.length > 0 ? (childNodes[numChildren - 1 - i] ?? null) : null;
    const child = parseExpressionNode({ nodes, lexemeMap, childType: childChildType });
    if (child) rootNode.children.unshift(child);
  }

  return rootNode;
}

function parseExpression(
  {
    iterator,
    lexemeMap,
    childType,
  }: {
    iterator: Iterator<ParserEvent>,
    lexemeMap: Record<number, Lexeme>,
    childType: string | null | undefined,
  }) {
  const nodes: ExtendedParserEvent[] = [];
  let currentNodeEvent: ExtendedParserEvent | null = null;

  // this loop should either flip the stack or process nodes, not both
  for (let iterResult = iterator.next();
       !iterResult.done && iterResult.value.action !== PARSER_ACTIONS.CLOSE_EXPRESSION;
       iterResult = iterator.next()) {
    switch (iterResult.value.action) {
      case PARSER_ACTIONS.OPEN_EXPRESSION: {
	throw Error('No nested expressions');
      }
      case PARSER_ACTIONS.EXPRESSION_CHILD: {
	if (!currentNodeEvent) {
	  continue;
	}

	if (!currentNodeEvent.childNodes) {
	  currentNodeEvent.childNodes = [];
	  currentNodeEvent.isNode = false;
	}

	currentNodeEvent.childNodes.push(iterResult.value.value || '');
	break;
      }
      default: {
	currentNodeEvent = {
	  childNodes: [],
	  isNode: false,
	  ...iterResult.value
	};
	// pushing an event not a node!
	nodes.push(currentNodeEvent);
      }
    }
  }

  return parseExpressionNode({ nodes, lexemeMap, childType });
}

function parseNode({
  iterator,
  lexemeMap,
  node,
}: {
  iterator: Iterator<ParserEvent>
  lexemeMap: Record<number, Lexeme>,
  node: AstNode,
}) {
    let iterResult = iterator.next();
    let childType = null;
    while (!iterResult.done) {
	const parserEvent = iterResult.value;

	switch (parserEvent.action) {
	case PARSER_ACTIONS.OPEN:
	    if (!parserEvent.node_type) break;
	    const childNode = createNode(parserEvent.node_type, childType, parserEvent.start);
	    parseNode({ node: childNode, lexemeMap, iterator });
	    node.children.push(childNode);
	    break;
	case PARSER_ACTIONS.CLOSE:
	    return;
	case PARSER_ACTIONS.ATTR:
	    if (!parserEvent.value) break;
	    node.attrs[parserEvent.value] = lexemeMap[parserEvent.start].text;
	    (node.attrStarts ??= {})[parserEvent.value] = parserEvent.start;
	    break;
	case PARSER_ACTIONS.PUSHATTR:
	    if (!parserEvent.value) break;

	    let arrayAttr = node.attrs[parserEvent.value];
	    if (arrayAttr == null) {
		arrayAttr = node.attrs[parserEvent.value] = [];
	    } else if (!Array.isArray(arrayAttr)) {
	      break;
	    }

	    arrayAttr.push(lexemeMap[parserEvent.start].text);

	    const attrStarts = node.attrStarts ??= {};
	    let paramStarts = attrStarts[parserEvent.value];
	    if (!Array.isArray(paramStarts)) {
		paramStarts = attrStarts[parserEvent.value] = [];
	    }
	    paramStarts.push(parserEvent.start);
	    break;
	case PARSER_ACTIONS.CHILD_TYPE:
	    childType = parserEvent.value;
	    break;
	case PARSER_ACTIONS.OPEN_EXPRESSION: {
	    const expr = parseExpression({ lexemeMap, iterator, childType });
	    if (expr) node.children.push(expr);
	    break;
	}
	}


	iterResult = iterator.next();
    }
}


type LoxStateProps = {
    text: string | null;
    stdout: string[];
    consoleMessages: ConsoleMessage[];
    lexerEvents: LexerEvent[];
    parserEvents: ParserEvent[];
    compilerEvents: CompilerEvent[];
    lexemes: Lexeme[];
    lexemeMap: Record<number, Lexeme>;
    ast: AstNode;
}

export class LoxState extends State<LoxStateProps> {
    props: LoxStateProps;

    constructor() {
	super();
	this.props = {
	    text: null,
	    stdout: [],
	    consoleMessages: [],
	    lexerEvents: [],
	    parserEvents: [],
	    compilerEvents: [],
	    lexemes: [],
	    lexemeMap: {},
	    ast: createNode(NODE_TYPE.PROGRAM),
	};
    }

    lex() {
        const lexemes: Lexeme[] = [];
	let pointer = 0;
	const text = this.get('text');
	if (text === null) return lexemes;
	const lexerEvents = this.get('lexerEvents');

	for (let token of lexerEvents.map(mapToken)) {
	    if (token.start > pointer) {
		lexemes.push({
		    text: text.slice(pointer, token.start),
		    type: null,
		    category: null,
		    start: pointer,
		    length: token.start - pointer,
		});
	    }

	    pointer = token.start + token.length;

	    lexemes.push({
		category: token.category,
		type: token.type,
		start: token.start,
		length: token.length,
		text: text.slice(token.start, token.start + token.length),
	    });
	}

	this.set('lexemes', lexemes);

	return lexemes;
    }

    parse(): AstNode {
	const lexemes = this.get('lexemes');
	const parserEvents = this.get('parserEvents');

	const root = createNode(NODE_TYPE.PROGRAM);

	const iterator = parserEvents.values();

	const lexemeMap: Record<number, Lexeme> = {};
	for (let lexeme of lexemes) {
	    lexemeMap[lexeme.start] = lexeme;
	}

	parseNode({ node: root, lexemeMap, iterator });

	if (!iterator.next().done) {
	    console.error('Parser error: incomplete');
	}

	this.set('ast', root);

	return root;
    }

    compile(): Map<string, CompilerEvent[]> {
	const chunks = new Map<string, CompilerEvent[]>();
	for (const event of this.get('compilerEvents')) {
	    let list = chunks.get(event.chunk);
	    if (!list) {
		list = [];
		chunks.set(event.chunk, list);
	    }
	    list.push(event);
	}
	return chunks;
    }

}
