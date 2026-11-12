import { assert } from 'chai';
import { DEFAULT_SAMPLE_LABEL, defaultSample, loxSamples } from '@/lox-visualizer/samples';

describe('loxSamples', () => {
    it('exposes six uniquely labelled entries including the default', () => {
        assert.lengthOf(loxSamples, 6);
        const labels = loxSamples.map((s) => s.label);
        assert.lengthOf(new Set(labels), labels.length);
        assert.include(labels, DEFAULT_SAMPLE_LABEL);
    });

    it('loads each sample as non-empty Lox source, except Empty', async () => {
        for (const s of loxSamples) {
            const text = await s.load();
            assert.isString(text, s.label);
            if (s.label === 'Empty') {
                assert.equal(text, '');
            } else {
                assert.isAbove(text.trim().length, 0, s.label);
            }
        }
    });

    it('resolves loop_printer to the sample program', async () => {
        const entry = loxSamples.find((s) => s.label === 'Loop printer');
        assert.exists(entry);
        assert.include(await entry!.load(), 'loopPrinter');
    });
});

describe('defaultSample', () => {
    it('is the first entry, and is what the picker starts on', () => {
        assert.equal(defaultSample, loxSamples[0]);
        assert.equal(DEFAULT_SAMPLE_LABEL, defaultSample.label);
    });

    it('loads the document the editor opens on', async () => {
        assert.include(await defaultSample.load(), 'loopPrinter');
    });
});
