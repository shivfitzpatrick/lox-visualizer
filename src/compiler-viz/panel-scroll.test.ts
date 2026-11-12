// @vitest-environment jsdom

import { assert } from 'chai';
import { createStore } from '@/lib/store';
import { ConnectorLayer } from '@/compiler-viz/connector-layer';
import { VisualizationPanel } from '@/compiler-viz/visualization-panel';
import { scrollIntoViewWithin } from '@/compiler-viz/d3-utils';
import type { VizSelection } from '@/compiler-viz/types';

// jsdom has no layout, so the vertical band each element occupies is stubbed
// directly; only top/bottom are read.
function boxed(top: number, bottom: number): HTMLElement {
    const el = document.createElement('div');
    el.getBoundingClientRect = () => ({ top, bottom, height: bottom - top }) as DOMRect;
    return el;
}

describe('scrollIntoViewWithin()', () => {
    // Container occupies viewport rows 100..300.
    const box = () => boxed(100, 300);

    it('scrolls down by the overshoot when the target is below the box', () => {
        const container = box();
        container.scrollTop = 0;

        scrollIntoViewWithin(boxed(350, 370), container);

        assert.equal(container.scrollTop, 70);
    });

    it('scrolls up to the target top when the target is above the box', () => {
        const container = box();
        container.scrollTop = 100;

        scrollIntoViewWithin(boxed(50, 70), container);

        assert.equal(container.scrollTop, 50);
    });

    it('does nothing when the target is already fully visible', () => {
        const container = box();
        container.scrollTop = 40;

        scrollIntoViewWithin(boxed(150, 170), container);

        assert.equal(container.scrollTop, 40);
    });

    it('aligns the top for a target taller than the box', () => {
        const container = box();
        container.scrollTop = 0;

        // 380 tall in a 200 tall box: bottom-aligning would scroll its top out
        // of sight, so only the 20px needed to align the top is applied.
        scrollIntoViewWithin(boxed(120, 500), container);

        assert.equal(container.scrollTop, 20);
    });

    it('leaves the document alone', () => {
        const container = box();
        container.scrollTop = 0;
        document.documentElement.scrollTop = 0;

        scrollIntoViewWithin(boxed(350, 370), container);

        assert.equal(document.documentElement.scrollTop, 0);
    });
});

class ProbePanel extends VisualizationPanel {
    readonly panelId = 'probe';
    refreshCount = 0;

    onDataChange() {}
    onSelectionChange() {}

    override refreshAnchor(): void {
        this.refreshCount += 1;
    }
}

function mountProbe() {
    const root = document.createElement('div');
    const container = document.createElement('div');
    root.appendChild(container);
    document.body.appendChild(root);

    const panel = new ProbePanel(
        container,
        createStore({ data: null }),
        createStore<VizSelection>({ selectedStart: null, selectedAstNode: null }),
        new ConnectorLayer(root),
    );
    panel.setUp();
    return { panel, container };
}

// Lets the panel's rAF-coalesced handler run.
const nextFrame = () => new Promise((resolve) => requestAnimationFrame(() => resolve(null)));

describe('VisualizationPanel container scroll', () => {
    it('re-measures the anchor when the panel scrolls', async () => {
        const { panel, container } = mountProbe();
        assert.equal(panel.refreshCount, 0);

        container.dispatchEvent(new Event('scroll'));
        await nextFrame();

        assert.equal(panel.refreshCount, 1);
    });

    it('coalesces a burst of scroll events into one refresh', async () => {
        const { panel, container } = mountProbe();

        for (let i = 0; i < 5; i++) container.dispatchEvent(new Event('scroll'));
        await nextFrame();

        assert.equal(panel.refreshCount, 1);
    });

    it('stops listening after tearDown', async () => {
        const { panel, container } = mountProbe();
        panel.tearDown();

        container.dispatchEvent(new Event('scroll'));
        await nextFrame();

        assert.equal(panel.refreshCount, 0);
    });

    it('drops a refresh already queued when tearDown runs', async () => {
        const { panel, container } = mountProbe();

        container.dispatchEvent(new Event('scroll'));
        panel.tearDown();
        await nextFrame();

        assert.equal(panel.refreshCount, 0);
    });
});
