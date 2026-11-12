import { VisualizationPanel } from '@/compiler-viz/visualization-panel';
import type { Store } from '@/lib/store';
import type { ConnectorLayer } from '@/compiler-viz/connector-layer';
import type { VizData, VizDataStore, VizSelection } from '@/compiler-viz/types';
import { panelSelection, selectionElement } from '@/compiler-viz/d3-utils';
import { drawAst } from '@/compiler-viz/ast';
import type { AstHandle, AstNode } from '@/compiler-viz/ast';
import { colors } from '@/compiler-viz/theme';
import type { ExecutionStore, VmStep } from '@/compiler-viz/execution';
import { AstNavControls } from '@/compiler-viz/panels/ast-nav-controls';

// Hub of the selection model. Renders the AST via drawAst, focuses/animates to
// the selected node, resolves selectedStart → selectedAstNode (writing it back
// to the store for the lexer panel), and publishes the 'ast' anchor shared by
// both connector lines. Canvas focus changes flow in via drawAst's onHighlight
// callback; cross-panel selection flows in via onSelectionChange.
export class AstPanel extends VisualizationPanel {
    readonly panelId = 'ast';

    private handle: AstHandle | null = null;
    private navControls: AstNavControls | null = null;
    private execHighlightStart: number | null = null;
    private unsubExecution?: () => void;
    private skipNextHighlight = false;

    constructor(
        container: HTMLElement,
        dataStore: VizDataStore,
        selectionStore: Store<VizSelection>,
        connectors: ConnectorLayer,
        private executionStore?: ExecutionStore,
    ) {
        super(container, dataStore, selectionStore, connectors);
    }

    setUp() {
        super.setUp();
        this.navControls = new AstNavControls(this.container);
        if (this.executionStore) {
            this.unsubExecution = this.executionStore.subscribe((state) => {
                if (!state.active || state.currentStep === null) {
                    this.clearExecHighlight();
                } else {
                    this.applyExecHighlight(state.steps[state.currentStep]);
                }
            });
            const state = this.executionStore.get();
            if (state.active && state.currentStep !== null) {
                this.applyExecHighlight(state.steps[state.currentStep]);
            }
        }
    }

    onDataChange(data: VizData) {
        this.handle?.destroy();
        this.execHighlightStart = null;
        this.connectors.setAnchor('ast-exec', null);

        this.handle = drawAst(
            panelSelection(this.container),
            data.ast,
            colors,
            (node: AstNode | null, _el: Element | null) => {
                this.navControls?.sync();
                // When panning for execution the flag is set to prevent the pan
                // from writing back to selectionStore (which would add a
                // bc-selected highlight on top of the bc-executing row).
                if (this.skipNextHighlight) {
                    this.skipNextHighlight = false;
                    return;
                }
                if (node && node.start != null) {
                    this.selectionStore.set({ selectedStart: node.start, selectedAstNode: node });
                    this.setAnchor(this.handle?.getSelectedNodeRect() ?? null);
                } else {
                    this.selectionStore.set({ selectedStart: null, selectedAstNode: null });
                    this.setAnchor(null);
                }
            },
        );
        this.navControls?.setHandle(this.handle);

        // Re-apply execution highlight in the freshly rendered SVG.
        const state = this.executionStore?.get();
        if (state && state.active && state.currentStep !== null) {
            this.applyExecHighlight(state.steps[state.currentStep]);
        }
    }

    onSelectionChange(state: VizSelection) {
        if (state.selectedStart === null) {
            // Don't cancel navigation: moveFocus set navigating=true and will
            // restore selection when the pan completes. Only clear when idle.
            if (!this.handle?.isNavigating()) {
                this.handle?.clearFocus();
            }
            this.setAnchor(null);
            return;
        }

        // Resolve start → node so the lexer panel can highlight the subtree.
        // Idempotent: the store guard drops the write when nothing changes.
        const resolved = state.selectedAstNode ?? this.handle?.findByStart(state.selectedStart) ?? null;
        if (state.selectedAstNode === null && resolved) {
            this.selectionStore.set({
                selectedAstNode: resolved,
                selectedStart: resolved.start ?? state.selectedStart,
            });
        }

        // Already focused on this node (e.g. the selection round-tripped from
        // this panel, or the idempotent write-back above already focused it):
        // skip re-animating to the same node.
        if (resolved && this.handle?.getSelectedNode()?.start === resolved.start) return;

        // Anchor is published by the onHighlight callback once the transition
        // settles, so the rect is final — no synchronous setAnchor needed here.
        // AstHandle is itself the focusByStart callable.
        this.handle?.(state.selectedStart);
    }

    refreshAnchor(): void {
        this.setAnchor(this.handle?.getSelectedNode() ? this.handle.getSelectedNodeRect() : null);
        const active = this.executionStore?.get().active ?? false;
        if (active && this.execHighlightStart !== null) {
            this.connectors.setAnchor('ast-exec', this.execAnchorRect());
        } else {
            this.connectors.setAnchor('ast-exec', null);
        }
    }

    tearDown() {
        this.unsubExecution?.();
        this.unsubExecution = undefined;
        this.clearExecHighlight();
        this.handle?.destroy();
        this.handle = null;
        this.navControls?.destroy();
        this.navControls = null;
        this.setAnchor(null);
        super.tearDown();
    }

    private applyExecHighlight(step: VmStep): void {
        this.clearExecHighlight();

        // Look up the instruction's srcOffset from the compiled data.
        const data = this.dataStore.get().data;
        if (!data) return;
        const instrs = data.chunks.get(step.chunk);
        if (!instrs) return;
        const instr = instrs.find(i => i.offset === step.offset);
        if (!instr) return;

        panelSelection(this.container)
            .select(`g[data-start="${instr.srcOffset}"]`)
            .classed('ast-executing', true);
        this.execHighlightStart = instr.srcOffset;
        this.connectors.setAnchor('ast-exec', this.execAnchorRect());

        // Pan the AST viewport to the executing node without triggering a
        // selection write-back (which would add bc-selected on top of bc-executing).
        if (this.handle) {
            this.skipNextHighlight = true;
            this.handle(instr.srcOffset);
        }
    }

    // Returns the exec-highlighted node's rect only when it actually overlaps the
    // panel's viewport — otherwise the connector line would draw to an off-screen
    // position (D3 zoom can place nodes outside the visible SVG area).
    private execAnchorRect(): DOMRect | null {
        if (this.execHighlightStart === null) return null;
        const el = selectionElement<Element>(
            panelSelection(this.container).select(`g[data-start="${this.execHighlightStart}"]`),
        );
        if (!el) return null;
        const nodeRect = el.getBoundingClientRect();
        if (nodeRect.width === 0 && nodeRect.height === 0) return null;
        const panelRect = this.container.getBoundingClientRect();
        const overlaps =
            nodeRect.left < panelRect.right &&
            nodeRect.right > panelRect.left &&
            nodeRect.top < panelRect.bottom &&
            nodeRect.bottom > panelRect.top;
        return overlaps ? nodeRect : null;
    }

    private clearExecHighlight(): void {
        panelSelection(this.container)
            .selectAll('g.ast-executing')
            .classed('ast-executing', false);
        this.execHighlightStart = null;
        this.connectors.setAnchor('ast-exec', null);
    }
}
