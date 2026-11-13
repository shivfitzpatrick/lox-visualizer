// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { VisualizationPanel } from '@/compiler-viz/visualization-panel';
import { drawBytecode } from '@/compiler-viz/bytecode';
import { collectSubtreeStarts, type AstNode } from '@/compiler-viz/ast';
import { panelSelection, selectionElement, scrollIntoViewWithin } from '@/compiler-viz/d3-utils';
import type { VizData, VizDataStore, VizSelection, Instruction } from '@/compiler-viz/types';
import type { Store } from '@/lib/store';
import type { ConnectorLayer } from '@/compiler-viz/connector-layer';
import type { ExecutionStore } from '@/compiler-viz/execution';

// Ops that load or store a named local variable (incl. closure cells).
// Used to find all bytecode references to a function parameter.
const LOCAL_VAR_OPS = new Set([
    'LOAD_FAST', 'STORE_FAST', 'DELETE_FAST',
    'LOAD_DEREF', 'STORE_DEREF',
    'LOAD_FAST_CHECK', 'LOAD_FAST_AND_CLEAR',
]);

// Wraps drawBytecode behind the panel interface. Clicking an instruction writes
// its src_offset to the selection store; on selection change the panel
// highlights the matching row and publishes the 'bc' anchor for the ast↔bc line.
// A ► marker tracks the currently executing instruction during playback.
export class BytecodePanel extends VisualizationPanel {
    readonly panelId = 'bc';

    private selectedOffsets: Set<number> = new Set();
    private primaryOffset: number | null = null;
    private argAnchorChunk: string | null = null;
    private argAnchorOffset: number | null = null;
    private executingChunk: string | null = null;
    private executingOffset: number | null = null;
    private unsubExecution?: () => void;

    constructor(
        container: HTMLElement,
        dataStore: VizDataStore,
        selectionStore: Store<VizSelection>,
        connectors: ConnectorLayer,
        private executionStore: ExecutionStore,
    ) {
        super(container, dataStore, selectionStore, connectors);
    }

    setUp(): void {
        super.setUp();
        this.unsubExecution = this.executionStore.subscribe((state) => {
            if (!state.active || state.currentStep === null) {
                this.clearExecutingVisual();
            } else {
                const step = state.steps[state.currentStep];
                this.setExecuting(step.chunk, step.offset);
            }
        });
        // Prime from current store state in case data already arrived.
        const state = this.executionStore.get();
        if (state.active && state.currentStep !== null) {
            const step = state.steps[state.currentStep];
            this.setExecuting(step.chunk, step.offset);
        }
    }

    onDataChange(data: VizData): void {
        // Clear before redraw — old rows are about to be removed.
        this.setExecuting(null, null);

        const onClick = (instr: Instruction | null, _el: HTMLElement | null) => {
            if (!instr) return;
            // Write only selectedStart; the AST panel resolves selectedAstNode
            // and writes it back so the lexer can highlight the subtree.
            this.selectionStore.set({ selectedStart: instr.srcOffset, selectedAstNode: null });
        };

        drawBytecode(panelSelection(this.container), data.chunks, onClick);

        // Re-apply executing state — drawBytecode rebuilt all rows.
        const state = this.executionStore.get();
        if (state.active && state.currentStep !== null) {
            const step = state.steps[state.currentStep];
            this.setExecuting(step.chunk, step.offset);
        }
    }

    onSelectionChange(state: VizSelection): void {
        this.clearRowHighlight();

        if (state.selectedStart === null) {
            this.setAnchor(null);
            return;
        }

        if (state.selectedAstNode?.type === 'arg') {
            this.applyArgHighlight(state.selectedAstNode);
            return;
        }

        if (state.selectedAstNode && (state.selectedAstNode.type === 'Function' || state.selectedAstNode.type === 'Method')) {
            const node = state.selectedAstNode;
            const paramStartsRaw = node.attrStarts?.params;
            if (Array.isArray(paramStartsRaw) && paramStartsRaw.includes(state.selectedStart)) {
                this.applyParamHighlight(node, state.selectedStart);
                return;
            }
        }

        if (state.selectedAstNode) {
            // AST-selection path: highlight every instruction in the subtree.
            // Primary token rows (node.start) get bc-selected; the rest get
            // bc-highlight, mirroring the lexer panel's code-primary/code-highlighted split.
            const node = state.selectedAstNode;
            const offsets = collectSubtreeStarts(node);
            for (const offset of offsets) {
                const rows = panelSelection(this.container)
                    .selectAll<HTMLTableRowElement, unknown>(`tr[data-src-offset="${offset}"]`);
                rows.each(function() { this.closest('details')?.setAttribute('open', ''); });
                rows.classed(offset === node.start ? 'bc-selected' : 'bc-highlight', true);
            }
            this.selectedOffsets = new Set(offsets);
            this.primaryOffset = node.start ?? null;
        } else {
            // Instruction-click path: single offset, unchanged behaviour.
            const rows = panelSelection(this.container)
                .selectAll<HTMLTableRowElement, unknown>(`tr[data-src-offset="${state.selectedStart}"]`);
            rows.each(function() { this.closest('details')?.setAttribute('open', ''); });
            rows.classed('bc-selected', true);
            this.selectedOffsets = new Set([state.selectedStart]);
            this.primaryOffset = state.selectedStart;
        }

        const anchorRow = this.findAnchorRow();
        if (anchorRow) {
            scrollIntoViewWithin(anchorRow, this.container);
            this.setAnchor(anchorRow.getBoundingClientRect());
        } else {
            this.setAnchor(null);
        }
    }

    refreshAnchor(): void {
        if (this.argAnchorChunk !== null && this.argAnchorOffset !== null) {
            const row = panelSelection(this.container).select<HTMLTableRowElement>(
                `tr[data-chunk="${this.argAnchorChunk}"][data-offset="${this.argAnchorOffset}"]`,
            );
            const el = selectionElement<HTMLTableRowElement>(row);
            this.setAnchor(el?.getBoundingClientRect() ?? null);
        } else {
            this.setAnchor(
                this.selectedOffsets.size > 0
                    ? (this.findAnchorRow()?.getBoundingClientRect() ?? null)
                    : null,
            );
        }

        const { active } = this.executionStore.get();
        if (active && this.executingChunk !== null && this.executingOffset !== null) {
            const row = panelSelection(this.container)
                .select<HTMLTableRowElement>(
                    `tr[data-chunk="${this.executingChunk}"][data-offset="${this.executingOffset}"]`,
                );
            const el = selectionElement<HTMLElement>(row);
            this.connectors.setAnchor('bc-exec', el ? el.getBoundingClientRect() : null);
        } else {
            this.connectors.setAnchor('bc-exec', null);
        }
    }

    tearDown(): void {
        this.unsubExecution?.();
        this.unsubExecution = undefined;
        this.clearExecutingVisual();
        this.executingChunk = null;
        this.executingOffset = null;
        this.clearRowHighlight();
        this.setAnchor(null);
        super.tearDown();
    }

    // Removes the DOM class and bc-exec connector anchor without forgetting the
    // current position. Used when execution mode deactivates so it can be
    // re-shown without re-querying the store.
    private clearExecutingVisual(): void {
        panelSelection(this.container)
            .selectAll('tr.bc-executing')
            .classed('bc-executing', false);
        this.connectors.setAnchor('bc-exec', null);
    }

    private setExecuting(chunk: string | null, offset: number | null): void {
        this.clearExecutingVisual();
        this.executingChunk = null;
        this.executingOffset = null;

        if (chunk === null || offset === null) return;

        const rowSel = panelSelection(this.container)
            .select<HTMLTableRowElement>(`tr[data-chunk="${chunk}"][data-offset="${offset}"]`);
        const row = selectionElement<HTMLElement>(rowSel);
        if (!row) return;

        rowSel.classed('bc-executing', true);
        this.executingChunk = chunk;
        this.executingOffset = offset;

        const details = row.closest<HTMLDetailsElement>('details');
        if (details && !details.open) details.open = true;
        scrollIntoViewWithin(row, this.container);
        this.connectors.setAnchor('bc-exec', row.getBoundingClientRect());
    }

    private findAnchorRow(): HTMLTableRowElement | null {
        if (this.primaryOffset === null) return null;
        const row = panelSelection(this.container)
            .select<HTMLTableRowElement>(`tr.bc-selected[data-src-offset="${this.primaryOffset}"]`);
        return selectionElement<HTMLTableRowElement>(row);
    }

    private applyParamHighlight(node: AstNode, selectedStart: number): void {
        const paramStarts = node.attrStarts!.params as number[];
        const paramIndex = paramStarts.indexOf(selectedStart);
        if (paramIndex === -1) return;

        const chunkName = typeof node.attrs.name === 'string' ? node.attrs.name : null;
        if (!chunkName) return;

        const data = this.dataStore.get().data;
        if (!data) return;

        const instrs = data.chunks.get(chunkName);
        if (!instrs) return;

        const paramSlot = paramIndex + 1;  // slot 0 is the fn placeholder / 'this'

        let firstChunk: string | null = null;
        let firstOffset: number | null = null;
        for (const instr of instrs) {
            if ((instr.op !== 'OP_GET_LOCAL' && instr.op !== 'OP_SET_LOCAL') || instr.arg !== paramSlot) continue;
            const rows = panelSelection(this.container).selectAll<HTMLTableRowElement, unknown>(
                `tr[data-chunk="${chunkName}"][data-offset="${instr.offset}"]`,
            );
            rows.each(function() { this.closest('details')?.setAttribute('open', ''); });
            rows.classed('bc-highlight', true);
            if (firstChunk === null) {
                firstChunk = chunkName;
                firstOffset = instr.offset;
            }
        }

        if (firstChunk !== null && firstOffset !== null) {
            this.argAnchorChunk = firstChunk;
            this.argAnchorOffset = firstOffset;
            const anchorRow = panelSelection(this.container).select<HTMLTableRowElement>(
                `tr[data-chunk="${firstChunk}"][data-offset="${firstOffset}"]`,
            );
            const el = selectionElement<HTMLTableRowElement>(anchorRow);
            if (el) {
                scrollIntoViewWithin(el, this.container);
                this.setAnchor(el.getBoundingClientRect());
                return;
            }
        }
        this.setAnchor(null);
    }

    private applyArgHighlight(node: AstNode): void {
        const chunkName = typeof node.attrs.chunk === 'string' ? node.attrs.chunk : null;
        const paramName = typeof node.attrs.name === 'string' ? node.attrs.name : null;
        if (!chunkName || !paramName) return;

        const data = this.dataStore.get().data;
        if (!data) return;

        const instrs = data.chunks.get(chunkName);
        if (!instrs) return;

        let firstChunk: string | null = null;
        let firstOffset: number | null = null;
        for (const instr of instrs) {
            if (!LOCAL_VAR_OPS.has(instr.op) || instr.constant !== paramName) continue;
            const rows = panelSelection(this.container).selectAll<HTMLTableRowElement, unknown>(
                `tr[data-chunk="${chunkName}"][data-offset="${instr.offset}"]`,
            );
            rows.each(function() { this.closest('details')?.setAttribute('open', ''); });
            rows.classed('bc-highlight', true);
            if (firstChunk === null) {
                firstChunk = chunkName;
                firstOffset = instr.offset;
            }
        }

        if (firstChunk !== null && firstOffset !== null) {
            this.argAnchorChunk = firstChunk;
            this.argAnchorOffset = firstOffset;
            const anchorRow = panelSelection(this.container).select<HTMLTableRowElement>(
                `tr[data-chunk="${firstChunk}"][data-offset="${firstOffset}"]`,
            );
            const el = selectionElement<HTMLTableRowElement>(anchorRow);
            if (el) {
                scrollIntoViewWithin(el, this.container);
                this.setAnchor(el.getBoundingClientRect());
                return;
            }
        }
        this.setAnchor(null);
    }

    private clearRowHighlight(): void {
        panelSelection(this.container)
            .selectAll('tr.bc-selected, tr.bc-highlight')
            .classed('bc-selected bc-highlight', false);
        this.selectedOffsets = new Set();
        this.primaryOffset = null;
        this.argAnchorChunk = null;
        this.argAnchorOffset = null;
    }
}
