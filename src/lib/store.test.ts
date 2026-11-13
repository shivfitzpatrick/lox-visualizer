// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { assert } from 'chai';
import { createStore } from '@/lib/store';

interface Counter {
    a: number;
    b: number;
}

describe('createStore()', () => {
    it('get() returns the initial state', () => {
        const store = createStore<Counter>({ a: 1, b: 2 });

        assert.deepEqual(store.get(), { a: 1, b: 2 });
    });

    it('set() shallow-merges the patch and get() reflects it', () => {
        const store = createStore<Counter>({ a: 1, b: 2 });

        store.set({ b: 3 });

        assert.deepEqual(store.get(), { a: 1, b: 3 });
    });

    it('subscribe() fires with the merged state and the returned function unsubscribes', () => {
        const store = createStore<Counter>({ a: 1, b: 2 });
        const seen: Counter[] = [];
        const unsubscribe = store.subscribe((state) => seen.push(state));

        store.set({ a: 10 });

        assert.deepEqual(seen, [{ a: 10, b: 2 }]);

        unsubscribe();
        store.set({ a: 20 });

        assert.deepEqual(seen, [{ a: 10, b: 2 }]);
    });

    it('set() with an unchanged value does not notify (loop-guard)', () => {
        const store = createStore<Counter>({ a: 1, b: 2 });
        let calls = 0;
        store.subscribe(() => calls++);

        store.set({ a: 1 });
        store.set({ a: 1, b: 2 });

        assert.equal(calls, 0);
    });

    it('notifies when at least one key changes even if another is unchanged', () => {
        const store = createStore<Counter>({ a: 1, b: 2 });
        let calls = 0;
        store.subscribe(() => calls++);

        store.set({ a: 1, b: 3 });

        assert.equal(calls, 1);
        assert.deepEqual(store.get(), { a: 1, b: 3 });
    });

    it('multiple subscribers all fire; unsubscribing one leaves the others', () => {
        const store = createStore<Counter>({ a: 1, b: 2 });
        let firstCalls = 0;
        let secondCalls = 0;
        const unsubscribeFirst = store.subscribe(() => firstCalls++);
        store.subscribe(() => secondCalls++);

        store.set({ a: 2 });

        assert.equal(firstCalls, 1);
        assert.equal(secondCalls, 1);

        unsubscribeFirst();
        store.set({ a: 3 });

        assert.equal(firstCalls, 1);
        assert.equal(secondCalls, 2);
    });

    it('unsubscribing inside a callback does not throw', () => {
        const store = createStore<Counter>({ a: 1, b: 2 });
        let otherCalls = 0;
        const unsubscribeSelf = store.subscribe(() => {
            unsubscribeSelf();
        });
        store.subscribe(() => otherCalls++);

        assert.doesNotThrow(() => store.set({ a: 2 }));
        assert.equal(otherCalls, 1);
    });
});
