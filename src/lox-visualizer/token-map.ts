import { TokenCategory, TokenType } from '@/lox-visualizer/state/token';

/** Maps a language-specific token type key to a highlight bucket. */
export type TokenCategoryMap = Record<string, { category: TokenCategory | null }>;

/** Lox/clox token types → shared highlight categories. */
export const LOX_TOKEN_CATEGORY_MAP: Record<keyof typeof TokenType, { category: TokenCategory | null }> = {
    TOKEN_LEFT_PAREN: { category: TokenCategory.PAREN },
    TOKEN_RIGHT_PAREN: { category: TokenCategory.PAREN },

    TOKEN_LEFT_BRACE: { category: TokenCategory.BRACE },
    TOKEN_RIGHT_BRACE: { category: TokenCategory.BRACE },

    TOKEN_COMMA: { category: TokenCategory.OPERATOR },
    TOKEN_DOT: { category: TokenCategory.OPERATOR },
    TOKEN_MINUS: { category: TokenCategory.OPERATOR },
    TOKEN_PLUS: { category: TokenCategory.OPERATOR },

    TOKEN_COLON: { category: TokenCategory.OPERATOR },
    TOKEN_SEMICOLON: { category: TokenCategory.OPERATOR },
    TOKEN_SLASH: { category: TokenCategory.OPERATOR },
    TOKEN_STAR: { category: TokenCategory.OPERATOR },

    TOKEN_BANG: { category: TokenCategory.OPERATOR },
    TOKEN_BANG_EQUAL: { category: TokenCategory.OPERATOR },

    TOKEN_EQUAL: { category: TokenCategory.OPERATOR },
    TOKEN_EQUAL_EQUAL: { category: TokenCategory.OPERATOR },

    TOKEN_GREATER: { category: TokenCategory.OPERATOR },
    TOKEN_GREATER_EQUAL: { category: TokenCategory.OPERATOR },

    TOKEN_LESS: { category: TokenCategory.OPERATOR },
    TOKEN_LESS_EQUAL: { category: TokenCategory.OPERATOR },

    TOKEN_IDENTIFIER: { category: TokenCategory.IDENTIFIER },
    TOKEN_STRING: { category: TokenCategory.LITERAL },
    TOKEN_NUMBER: { category: TokenCategory.LITERAL },

    TOKEN_AND: { category: TokenCategory.KEYWORD },
    TOKEN_CASE: { category: TokenCategory.KEYWORD },
    TOKEN_CLASS: { category: TokenCategory.KEYWORD },
    TOKEN_DEFAULT: { category: TokenCategory.KEYWORD },
    TOKEN_ELSE: { category: TokenCategory.KEYWORD },
    TOKEN_FALSE: { category: TokenCategory.KEYWORD },

    TOKEN_FOR: { category: TokenCategory.KEYWORD },
    TOKEN_FUN: { category: TokenCategory.KEYWORD },
    TOKEN_IF: { category: TokenCategory.KEYWORD },
    TOKEN_NIL: { category: TokenCategory.KEYWORD },
    TOKEN_OR: { category: TokenCategory.KEYWORD },

    TOKEN_PRINT: { category: TokenCategory.KEYWORD },
    TOKEN_RETURN: { category: TokenCategory.KEYWORD },
    TOKEN_SUPER: { category: TokenCategory.KEYWORD },
    TOKEN_SWITCH: { category: TokenCategory.KEYWORD },
    TOKEN_THIS: { category: TokenCategory.KEYWORD },

    TOKEN_TRUE: { category: TokenCategory.KEYWORD },
    TOKEN_VAL: { category: TokenCategory.KEYWORD },
    TOKEN_VAR: { category: TokenCategory.KEYWORD },
    TOKEN_WHILE: { category: TokenCategory.KEYWORD },

    TOKEN_ERROR: { category: null },
    TOKEN_EOF: { category: null },
};
