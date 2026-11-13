// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { Component } from '@/lib/component';
import type { ExecutionStore } from '@/compiler-viz/execution';
import type { PanelKind } from '@/compiler-viz/layout';
import { clearContainer, panelSelection, selectionElement } from '@/compiler-viz/d3-utils';

export class PlaybackControls extends Component {
    readonly slotId: PanelKind = 'playback';

    private unsubExecution?: () => void;
    private intervalId: ReturnType<typeof setInterval> | null = null;

    private root!: ReturnType<typeof panelSelection>;
    private controls!: ReturnType<typeof panelSelection>;
    private startBtn!: ReturnType<typeof panelSelection>;
    private backBtn!: ReturnType<typeof panelSelection>;
    private playBtn!: ReturnType<typeof panelSelection>;
    private fwdBtn!: ReturnType<typeof panelSelection>;
    private endBtn!: ReturnType<typeof panelSelection>;
    private scrubEl!: ReturnType<typeof panelSelection>;
    private counterEl!: ReturnType<typeof panelSelection>;

    constructor(
        private container: HTMLElement,
        private executionStore: ExecutionStore,
    ) {
        super([], false);
    }

    setUp(): void {
        this.root = panelSelection(this.container).classed('lox-panel', true);
        this.buildDom();
        this.unsubExecution = this.executionStore.subscribe(() => this.update());
        this.update();
    }

    tearDown(): void {
        this.pause();
        this.unsubExecution?.();
        this.unsubExecution = undefined;
        clearContainer(this.container);
    }

    private buildDom(): void {
        this.root.on('click.executionMode', (event: MouseEvent) => {
            event.stopPropagation();
            this.executionStore.set({ active: true });
        });

        this.controls = this.root.append('div').classed('playback-controls', true);

        this.startBtn = this.controls.append('button')
            .classed('pb-start', true)
            .attr('title', 'First step')
            .text('◄◄')
            .on('click', () => this.goFirst());

        this.backBtn = this.controls.append('button')
            .classed('pb-back', true)
            .attr('title', 'Step back')
            .text('◄')
            .on('click', () => this.stepBackward());

        this.playBtn = this.controls.append('button')
            .classed('pb-play', true)
            .attr('title', 'Play / pause')
            .text('►')
            .on('click', () => this.togglePlay());

        this.fwdBtn = this.controls.append('button')
            .classed('pb-fwd', true)
            .attr('title', 'Step forward')
            .text('►')
            .on('click', () => this.stepForward());

        this.endBtn = this.controls.append('button')
            .classed('pb-end', true)
            .attr('title', 'Last step')
            .text('►►')
            .on('click', () => this.goLast());

        this.scrubEl = this.controls.append('input')
            .classed('pb-scrub', true)
            .attr('type', 'range')
            .attr('min', '0')
            .attr('value', '0')
            .attr('step', '1')
            .on('input', () => {
                this.pause();
                const scrub = selectionElement<HTMLInputElement>(this.scrubEl);
                if (!scrub) return;
                this.executionStore.set({ currentStep: Number(scrub.value), playing: false });
            });

        this.counterEl = this.controls.append('span').classed('pb-counter', true);
    }

    private goFirst(): void {
        this.pause();
        this.executionStore.set({ currentStep: 0, playing: false });
    }

    private goLast(): void {
        const { steps } = this.executionStore.get();
        if (steps.length === 0) return;
        this.pause();
        this.executionStore.set({ currentStep: steps.length - 1, playing: false });
    }

    private stepForward(): void {
        const { currentStep, steps } = this.executionStore.get();
        if (currentStep === null || currentStep >= steps.length - 1) {
            this.pause();
            this.executionStore.set({ playing: false });
            return;
        }
        this.executionStore.set({ currentStep: currentStep + 1 });
    }

    private stepBackward(): void {
        const { currentStep } = this.executionStore.get();
        if (currentStep === null || currentStep <= 0) return;
        this.executionStore.set({ currentStep: currentStep - 1 });
    }

    private togglePlay(): void {
        const { playing, currentStep, steps } = this.executionStore.get();
        if (playing) {
            this.pause();
            this.executionStore.set({ playing: false });
        } else {
            const atEnd = currentStep !== null && currentStep >= steps.length - 1;
            if (atEnd || currentStep === null) {
                this.executionStore.set({ currentStep: 0 });
            }
            this.executionStore.set({ playing: true });
            this.intervalId = setInterval(() => {
                const s = this.executionStore.get();
                if (s.currentStep === null || s.currentStep >= s.steps.length - 1) {
                    this.pause();
                    this.executionStore.set({ playing: false });
                    return;
                }
                this.executionStore.set({ currentStep: s.currentStep + 1 });
            }, 200);
        }
    }

    private pause(): void {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    private update(): void {
        const { steps, currentStep, playing, active } = this.executionStore.get();
        const total = steps.length;

        if (total === 0) {
            this.controls.style('display', 'none');
            this.container.dataset.empty = '';
        } else {
            this.controls.style('display', null);
            delete this.container.dataset.empty;
        }
        this.root.classed('execution-active', active);
        if (total === 0) return;

        const n = currentStep ?? 0;
        this.scrubEl
            .attr('max', String(total - 1))
            .attr('value', String(n));
        this.counterEl.text(`Step ${n + 1} / ${total}`);
        this.playBtn.text(playing ? '⏸' : '►');

        const atStart = n <= 0;
        const atEnd = n >= total - 1;
        this.startBtn.property('disabled', atStart);
        this.backBtn.property('disabled', atStart);
        this.fwdBtn.property('disabled', atEnd);
        this.endBtn.property('disabled', atEnd);
    }
}
