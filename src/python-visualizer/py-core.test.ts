import { assert } from 'chai';
import type { PyRunResult } from '@/python-visualizer/py-core';
import type { PyRawData } from '@/python-visualizer/py-data';

describe('PyRunResult discriminated union', () => {
    it('ok branch carries PyRawData', () => {
        const data: PyRawData = {
            source: 'x = 1',
            lexemes: [],
            ast: { type: 'Module', childType: null, start: 0, attrs: {}, children: [] },
            chunks: {},
        };
        const r: PyRunResult = { ok: true, data };
        assert.isTrue(r.ok);
        if (r.ok) assert.equal(r.data.source, 'x = 1');
    });

    it('error branch carries a message string', () => {
        const r: PyRunResult = { ok: false, error: 'SyntaxError: bad input' };
        assert.isFalse(r.ok);
        if (!r.ok) assert.include(r.error, 'SyntaxError');
    });
});
