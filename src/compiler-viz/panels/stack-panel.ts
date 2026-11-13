// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { select } from 'd3';
import { Component } from '@/lib/component';
import type { ExecutionStore, StackValue, VmStep } from '@/compiler-viz/execution';
import type { PanelKind } from '@/compiler-viz/layout';
import { clearContainer, panelSelection } from '@/compiler-viz/d3-utils';

type SlotRow     = { kind: 'slot';     idx: number; value: StackValue };
type LabelRow    = { kind: 'label';    fn: string };
type BoundaryRow = { kind: 'boundary' };
type RowDatum = SlotRow | LabelRow | BoundaryRow;

function buildRows(step: VmStep): RowDatum[] {
    const { stack, frames } = step;
    if (stack.length === 0) return [];

    const rows: RowDatum[] = [];
    // Sort frames so the innermost (highest base) comes first.
    const sorted = [...frames].sort((a, b) => b.base - a.base);
    let fi = 0;

    if (sorted.length > 0) {
        rows.push({ kind: 'label', fn: sorted[fi].fn });
    }

    for (let i = stack.length - 1; i >= 0; i--) {
        // Cross frame boundaries as we descend below each frame's base.
        while (fi + 1 < sorted.length && i < sorted[fi].base) {
            fi++;
            rows.push({ kind: 'boundary' });
            rows.push({ kind: 'label', fn: sorted[fi].fn });
        }
        rows.push({ kind: 'slot', idx: i, value: stack[i] });
    }

    return rows;
}

export function formatStackValue(v: StackValue): string {
    switch (v.t) {
        case 'nil':    return '(nil)';
        case 'bool':   return String(v.v);
        case 'num':    return String(v.v);
        case 'str': {
            const s = String(v.v ?? '');
            return '"' + (s.length > 20 ? s.slice(0, 20) + '…' : s) + '"';
        }
        case 'fn':     return `${v.name || '<fn>'}/${v.arity ?? '?'}`;
        case 'native': return '<native>';
        case 'class':  return v.name ?? '<class>';
        case 'inst':   return `${v.class ?? '?'} {}`;
        case 'method': return v.name ?? '<method>';
        case 'upval':  return '<upval>';
    }
}

function rowClass(d: RowDatum): string {
    if (d.kind === 'label')    return 'stack-frame-label';
    if (d.kind === 'boundary') return 'stack-frame-boundary';
    return 'stack-slot';
}

export class StackPanel extends Component {
    readonly slotId: PanelKind = 'stack';

    private unsubExecution?: () => void;

    constructor(
        private container: HTMLElement,
        private executionStore: ExecutionStore,
    ) {
        super([], false);
    }

    setUp() {
        panelSelection(this.container).classed('lox-panel', true);
        this.unsubExecution = this.executionStore.subscribe((state) => {
            if (state.currentStep === null) {
                this.renderEmpty();
            } else {
                this.renderStep(state.steps[state.currentStep]);
            }
        });
        // Prime from current state in case data already arrived.
        const { currentStep, steps } = this.executionStore.get();
        if (currentStep === null) {
            this.renderEmpty();
        } else {
            this.renderStep(steps[currentStep]);
        }
    }

    tearDown() {
        this.unsubExecution?.();
        this.unsubExecution = undefined;
        clearContainer(this.container);
    }

    private renderEmpty() {
        const sel = panelSelection(this.container);
        sel.select('table').remove();
        if (sel.select('p.stack-empty').empty()) {
            clearContainer(this.container);
            sel.append('p').attr('class', 'stack-empty')
                .text('Run a program to see the execution trace.');
        }
    }

    private renderStep(step: VmStep) {
        const rows = buildRows(step);
        const sel = panelSelection(this.container);

        sel.select('p.stack-empty').remove();

        let table = sel.select<HTMLTableElement>('table.stack-table');
        if (table.empty()) {
            table = sel.append('table').attr('class', 'stack-table');
            table.append('tbody');
        }

        table.select<HTMLTableSectionElement>('tbody')
            .selectAll<HTMLTableRowElement, RowDatum>('tr')
            .data(rows, (_d, i) => i)
            .join('tr')
            .attr('class', d => rowClass(d))
            .each(function(d) {
                const tr = select<HTMLTableRowElement, RowDatum>(this);
                tr.selectAll('td').remove();
                if (d.kind === 'label') {
                    tr.append('td').attr('colspan', '3').text(d.fn);
                } else if (d.kind === 'boundary') {
                    tr.append('td').attr('colspan', '3');
                } else {
                    tr.append('td').attr('class', 'stack-idx').text(`#${d.idx}`);
                    tr.append('td').attr('class', 'stack-type').text(d.value.t);
                    tr.append('td').attr('class', 'stack-val').text(formatStackValue(d.value));
                }
            });
    }
}
