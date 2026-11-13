// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { assert } from 'chai';
import { computeEndpoints } from '@/compiler-viz/connector-layer';

// Fabricate a DOMRect-like object from edges; right/bottom derived for parity.
function rect(left: number, top: number, width: number, height: number) {
    return {
        left,
        top,
        width,
        height,
        right: left + width,
        bottom: top + height,
    };
}

describe('computeEndpoints()', () => {
    it('from is below to: connects from.top to to.bottom', () => {
        const from = rect(0, 100, 20, 10);
        const to = rect(50, 0, 40, 10);

        assert.deepEqual(computeEndpoints(from, to), {
            x1: 10,
            y1: 100,
            x2: 70,
            y2: 10,
        });
    });

    it('from is above to: connects from.bottom to to.top', () => {
        const from = rect(0, 0, 20, 10);
        const to = rect(50, 100, 40, 10);

        assert.deepEqual(computeEndpoints(from, to), {
            x1: 10,
            y1: 10,
            x2: 70,
            y2: 100,
        });
    });

    it('overlapping vertically: connects vertical centers', () => {
        const from = rect(0, 0, 20, 40);
        const to = rect(50, 10, 40, 40);

        assert.deepEqual(computeEndpoints(from, to), {
            x1: 10,
            y1: 20,
            x2: 70,
            y2: 30,
        });
    });
});
