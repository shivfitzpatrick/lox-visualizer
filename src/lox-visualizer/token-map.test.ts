import { assert } from 'chai';
import { TokenCategory, TokenType } from '@/lox-visualizer/state/token';
import { LOX_TOKEN_CATEGORY_MAP } from '@/lox-visualizer/token-map';

function loxTokenTypeKeys(): (keyof typeof TokenType)[] {
    return (Object.keys(TokenType) as (keyof typeof TokenType)[]).filter(
        (key) => typeof key === 'string' && key.startsWith('TOKEN_'),
    );
}

describe('LOX_TOKEN_CATEGORY_MAP', () => {
    it('has an entry for every Lox TokenType key', () => {
        for (const key of loxTokenTypeKeys()) {
            assert.property(LOX_TOKEN_CATEGORY_MAP, key, `missing map entry for ${key}`);
        }
    });

    it('maps TOKEN_PRINT to KEYWORD and TOKEN_EOF to null', () => {
        assert.equal(LOX_TOKEN_CATEGORY_MAP.TOKEN_PRINT.category, TokenCategory.KEYWORD);
        assert.isNull(LOX_TOKEN_CATEGORY_MAP.TOKEN_EOF.category);
    });
});
