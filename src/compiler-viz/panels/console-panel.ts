import type { Store } from '@/lib/store';
import { VisualizationPanel } from '@/compiler-viz/visualization-panel';
import type { ConsoleStore, ConsoleMessage, VizData, VizDataStore, VizSelection } from '@/compiler-viz/types';
import type { ExecutionStore } from '@/compiler-viz/execution';
import type { ConnectorLayer } from '@/compiler-viz/connector-layer';
import { panelSelection, selectionElement } from '@/compiler-viz/d3-utils';

// Renders stdout print lines and stderr errors. Print lines with srcOffset are
// selectable; clicking one writes selectedStart so the bytecode panel can
// highlight the matching OP_PRINT row and the connector layer draws console↔bc.
export class ConsolePanel extends VisualizationPanel {
    readonly panelId = 'console';

    private selectedOffset: number | null = null;
    private unsubConsole?: () => void;
    private unsubExecution?: () => void;

    constructor(
        container: HTMLElement,
        dataStore: VizDataStore,
        private consoleStore: ConsoleStore,
        selectionStore: Store<VizSelection>,
        connectors: ConnectorLayer,
        private executionStore?: ExecutionStore,
    ) {
        super(container, dataStore, selectionStore, connectors);
    }

    setUp() {
        super.setUp();
        if (this.unsubConsole) return;

        this.unsubConsole = this.consoleStore.subscribe(() => this.renderAll());
        if (this.executionStore) {
            this.unsubExecution = this.executionStore.subscribe(() => this.renderAll());
        }
        this.renderAll();
    }

    tearDown() {
        this.unsubConsole?.();
        this.unsubConsole = undefined;
        this.unsubExecution?.();
        this.unsubExecution = undefined;
        this.clearLineHighlight();
        this.setAnchor(null);
        super.tearDown();
    }

    onDataChange(_data: VizData): void {}

    onSelectionChange(state: VizSelection): void {
        this.clearLineHighlight();

        if (state.selectedStart === null) {
            this.setAnchor(null);
            return;
        }

        const lines = panelSelection(this.container)
            .selectAll<HTMLElement, unknown>(`[data-src-offset="${state.selectedStart}"]`);
        if (lines.empty()) {
            this.setAnchor(null);
            return;
        }

        lines.classed('console-selected', true);
        this.selectedOffset = state.selectedStart;
        const firstLine = selectionElement<HTMLElement>(lines);
        this.setAnchor(firstLine ? firstLine.getBoundingClientRect() : null);
    }

    refreshAnchor(): void {
        if (this.selectedOffset === null) {
            this.setAnchor(null);
            return;
        }
        const line = panelSelection(this.container)
            .select<HTMLElement>(`[data-src-offset="${this.selectedOffset}"]`);
        const el = selectionElement<HTMLElement>(line);
        this.setAnchor(el ? el.getBoundingClientRect() : null);
    }

    private renderAll(): void {
        const exec = this.executionStore?.get();
        if (exec && exec.steps.length > 0) {
            const step = exec.currentStep ?? 0;
            const errors = this.consoleStore.get().messages.filter((m) => m.type === 'error');
            const prints: ConsoleMessage[] = exec.prints
                .filter((p) => p.stepIndex <= step)
                .map((p) => ({
                    type: 'print' as const,
                    text: p.text,
                    srcOffset: p.srcOffset,
                    chunk: p.chunk,
                    offset: p.offset,
                }));
            this.renderMessages([...errors, ...prints]);
        } else {
            this.renderMessages(this.consoleStore.get().messages);
        }
    }

    private renderMessages(messages: ConsoleMessage[]): void {
        const target = panelSelection(this.container);

        target
            .selectAll<HTMLDivElement, ConsoleMessage>('div')
            .data(messages, (_d, i) => i)
            .join('div')
            .attr('class', (d) => {
                if (d.type === 'error') return 'console-error';
                return d.srcOffset != null ? 'console-print console-selectable' : 'console-print';
            })
            .attr('data-src-offset', (d) =>
                d.type === 'print' && d.srcOffset != null ? String(d.srcOffset) : null,
            )
            .text((d) => d.text)
            .on('click', (event, d) => {
                if (d.type !== 'print' || d.srcOffset == null) return;
                event.stopPropagation();
                this.selectionStore.set({ selectedStart: d.srcOffset, selectedAstNode: null });
            });
    }

    private clearLineHighlight(): void {
        panelSelection(this.container)
            .selectAll('.console-selected')
            .classed('console-selected', false);
        this.selectedOffset = null;
    }
}
