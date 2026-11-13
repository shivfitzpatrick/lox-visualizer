// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { select } from 'd3';

import type { Store } from '@/lib/store';
import { VisualizationPanel } from '@/compiler-viz/visualization-panel';
import type { VizData, VizDataStore, VizSelection, Lexeme } from '@/compiler-viz/types';
import type { ConnectorLayer } from '@/compiler-viz/connector-layer';
import { collectSubtreeStarts } from '@/compiler-viz/ast';
import { TokenCategory } from '@/lox-visualizer/state/token';
import { LOX_TOKEN_CATEGORY_MAP, type TokenCategoryMap } from '@/lox-visualizer/token-map';
import { colors, weight } from '@/compiler-viz/theme';
import { panelSelection, selectionElement } from '@/compiler-viz/d3-utils';

// Renders source tokens as span.code-item elements. A click writes only
// selectedStart to the selection store (the AST panel resolves the node and
// writes it back); on selection change the panel highlights the selected
// subtree's spans and publishes its primary-span anchor for the ast↔lexer line.
export class LexerPanel extends VisualizationPanel {
    readonly panelId = 'lexer';

    private primaryStart: number | null = null;

    constructor(
        container: HTMLElement,
        dataStore: VizDataStore,
        selectionStore: Store<VizSelection>,
        connectors: ConnectorLayer,
        // Reserved: Python registry will pass PYTHON_TOKEN_CATEGORY_MAP in Phase 3.
        _tokenMap: TokenCategoryMap = LOX_TOKEN_CATEGORY_MAP,
    ) {
        super(container, dataStore, selectionStore, connectors);
    }

    onDataChange(data: VizData) {
        select<HTMLElement, unknown>(this.container)
            .selectAll<HTMLSpanElement, Lexeme>('span')
            .data(data.lexemes)
            .join(
                (enter) => enter.append('span').classed('code-item', true),
                (update) => update,
                (exit) => exit.remove(),
            )
            .attr('data-start', (d) => d.start)
            .text((d) => d.text)
            .classed('code-keyword', (d) => d.category === TokenCategory.KEYWORD)
            .classed('code-token', (d) => d.category !== null)
            .style('color', (d) => (d.category != null ? colors[d.category] ?? null : null))
            .style('font-weight', (d) => (d.category != null ? weight[d.category] ?? null : null))
            .style('cursor', (d) => (d.category !== null ? 'pointer' : null))
            .on('click', (event, d) => {
                if (d.category === null) return;
                event.stopPropagation();
                this.selectionStore.set({ selectedStart: d.start, selectedAstNode: null });
            });
    }

    onSelectionChange(state: VizSelection) {
        this.clearSpanHighlight();

        if (state.selectedStart === null) {
            this.setAnchor(null);
            return;
        }

        let primaryStart: number | null = null;

        if (state.selectedAstNode) {
            const node = state.selectedAstNode;
            for (const start of collectSubtreeStarts(node)) {
                this.styleSpan(start, start === node.start);
                if (start === node.start) primaryStart = start;
            }
        } else {
            primaryStart = state.selectedStart;
            this.styleSpan(state.selectedStart, true);
        }

        this.primaryStart = primaryStart;

        if (primaryStart === null) {
            this.setAnchor(null);
            return;
        }

        const primarySpan = panelSelection(this.container)
            .select<HTMLSpanElement>(`span[data-start="${primaryStart}"]`);
        const el = selectionElement<HTMLElement>(primarySpan);
        this.setAnchor(el ? el.getBoundingClientRect() : null);
    }

    refreshAnchor(): void {
        if (this.primaryStart === null) {
            this.setAnchor(null);
            return;
        }
        const primarySpan = panelSelection(this.container)
            .select<HTMLSpanElement>(`span[data-start="${this.primaryStart}"]`);
        const el = selectionElement<HTMLElement>(primarySpan);
        this.setAnchor(el ? el.getBoundingClientRect() : null);
    }

    tearDown() {
        super.tearDown();
        this.clearSpanHighlight();
    }

    // Apply subtree-highlight styling to the span at `start`, bordering it when
    // it is the primary span.
    private styleSpan(start: number, isPrimary: boolean): void {
        const span = panelSelection(this.container)
            .select<HTMLSpanElement>(`span[data-start="${start}"]`);
        span
            .classed('code-highlighted', true)
            .classed('code-primary', isPrimary);
    }

    private clearSpanHighlight() {
        panelSelection(this.container)
            .selectAll('span.code-highlighted, span.code-primary')
            .classed('code-highlighted code-primary', false);
        this.primaryStart = null;
    }
}
