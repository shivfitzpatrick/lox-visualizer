import { Component } from '@/lib/component';
import { clearContainer, panelSelection, selectionElement } from '@/compiler-viz/d3-utils';

/** A named sample program the picker can load on demand. */
export interface SampleProgram {
    label: string;
    load(): Promise<string>;
}

/** Standalone sample-program dropdown, mounted in its own bar above the app. */
export class SamplePicker extends Component {
    /** Guards against a slow sample load clobbering a later selection. */
    private loadToken = 0;

    constructor(
        private container: HTMLElement,
        private samples: SampleProgram[],
        private onSelect: (text: string) => void,
        private initialLabel?: string,
    ) {
        super([], false);
    }

    setUp() {
        if (this.samples.length === 0) return;

        const root = panelSelection(this.container);
        const picker = root.append('label').classed('lox-sample-picker', true);
        picker.append('span')
            .classed('lox-sample-picker__label', true)
            .text('Sample');
        const select = picker.append('select')
            .classed('lox-sample-picker__select', true);
        const initialIndex = this.samples.findIndex((s) => s.label === this.initialLabel);
        if (initialIndex < 0) {
            // No sample matches the editor's starting content, so a disabled
            // placeholder stands in for it (there is no way back once replaced).
            select.append('option')
                .attr('value', '')
                .attr('disabled', '')
                .attr('selected', '')
                .text('Choose a sample…');
        }
        for (const [i, sample] of this.samples.entries()) {
            const option = select.append('option').attr('value', String(i)).text(sample.label);
            if (i === initialIndex) option.attr('selected', '');
        }
        const selectEl = selectionElement<HTMLSelectElement>(select);
        select.on('change', () => {
            if (selectEl) void this.onSampleChange(selectEl);
        });
    }

    tearDown() {
        clearContainer(this.container);
    }

    private async onSampleChange(select: HTMLSelectElement): Promise<void> {
        const entry = this.samples[Number(select.value)];
        if (!entry) return;
        const token = ++this.loadToken;
        try {
            const text = await entry.load();
            if (token === this.loadToken) this.onSelect(text);
        } catch (e) {
            // Failed dynamic import (offline / stale deploy): change nothing.
            console.error('lox-visualizer: failed to load sample', entry.label, e);
        }
    }
}
