// @vitest-environment jsdom

import { assert } from 'chai';
import { SamplePicker } from '@/compiler-viz/sample-picker';
import type { SampleProgram } from '@/compiler-viz/sample-picker';

describe('SamplePicker', () => {
    function makePicker(samples: SampleProgram[], initialLabel?: string) {
        const container = document.createElement('div');
        container.className = 'lox-sample-picker-bar';
        const selected: string[] = [];
        const picker = new SamplePicker(container, samples, (text) => selected.push(text), initialLabel);
        picker.setUp();
        return { container, picker, selected };
    }

    function pick(container: HTMLElement, index: number): void {
        const select = container.querySelector('.lox-sample-picker__select') as HTMLSelectElement;
        select.value = String(index);
        select.dispatchEvent(new Event('change'));
    }

    const tick = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

    it('renders nothing without samples', () => {
        const { container, picker } = makePicker([]);
        assert.equal(container.childElementCount, 0);
        picker.tearDown();
    });

    it('renders a placeholder plus one option per sample', () => {
        const { container, picker } = makePicker([
            { label: 'One', load: () => Promise.resolve('print 1;') },
            { label: 'Two', load: () => Promise.resolve('print 2;') },
        ]);

        const options = container.querySelectorAll<HTMLOptionElement>('.lox-sample-picker__select option');
        assert.lengthOf(options, 3);
        assert.isTrue(options[0]!.disabled);
        assert.isTrue(options[0]!.selected);
        assert.equal(options[1]?.textContent, 'One');
        assert.equal(options[2]?.textContent, 'Two');
        picker.tearDown();
    });

    it('starts on the initialLabel option with no placeholder', () => {
        const { container, picker } = makePicker([
            { label: 'One', load: () => Promise.resolve('print 1;') },
            { label: 'Two', load: () => Promise.resolve('print 2;') },
        ], 'Two');

        const options = container.querySelectorAll<HTMLOptionElement>('.lox-sample-picker__select option');
        assert.lengthOf(options, 2);
        assert.isTrue(options[1]!.selected);
        assert.isFalse(options[0]!.disabled);
        picker.tearDown();
    });

    it('falls back to the placeholder when initialLabel matches nothing', () => {
        const { container, picker } = makePicker([
            { label: 'One', load: () => Promise.resolve('print 1;') },
        ], 'Missing');

        const options = container.querySelectorAll<HTMLOptionElement>('.lox-sample-picker__select option');
        assert.lengthOf(options, 2);
        assert.isTrue(options[0]!.disabled);
        assert.isTrue(options[0]!.selected);
        picker.tearDown();
    });

    it('reports the selected sample text via onSelect', async () => {
        const { container, picker, selected } = makePicker([
            { label: 'One', load: () => Promise.resolve('print "sample";') },
        ]);

        pick(container, 0);
        await tick();
        assert.deepEqual(selected, ['print "sample";']);
        picker.tearDown();
    });

    it('reports nothing when a sample fails to load', async () => {
        const { container, picker, selected } = makePicker([
            { label: 'Broken', load: () => Promise.reject(new Error('chunk 404')) },
        ]);

        pick(container, 0);
        await tick();
        assert.deepEqual(selected, []);
        picker.tearDown();
    });

    it('ignores a slow load that resolves after a later selection', async () => {
        let resolveSlow!: (text: string) => void;
        const { container, picker, selected } = makePicker([
            { label: 'Slow', load: () => new Promise<string>((resolve) => { resolveSlow = resolve; }) },
            { label: 'Fast', load: () => Promise.resolve('print "fast";') },
        ]);

        pick(container, 0);
        pick(container, 1);
        await tick();
        resolveSlow('print "slow";');
        await tick();
        assert.deepEqual(selected, ['print "fast";']);
        picker.tearDown();
    });

    it('clears its container on tearDown', () => {
        const { container, picker } = makePicker([
            { label: 'One', load: () => Promise.resolve('print 1;') },
        ]);
        assert.isAbove(container.childElementCount, 0);
        picker.tearDown();
        assert.equal(container.childElementCount, 0);
    });
});
