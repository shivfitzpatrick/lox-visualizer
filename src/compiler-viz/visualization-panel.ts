import { Component } from '@/lib/component';
import { panelSelection } from '@/compiler-viz/d3-utils';
import type { Store } from '@/lib/store';
import type { ConnectorLayer } from '@/compiler-viz/connector-layer';
import type { VizData, VizDataStore, VizSelection } from '@/compiler-viz/types';

// Base class for the main visualization windows (lexer, AST, bytecode).
// It standardizes container chrome, store wiring, and lifecycle so panels are
// interchangeable. Each panel subscribes to both stores: the data store (the
// derived compiler snapshot) and the selection store (the shared cross-panel
// selection). The orchestrator only writes to the stores — it never calls a
// panel method directly.
export abstract class VisualizationPanel extends Component {
    abstract readonly panelId: string;

    private didSetUp = false;
    private unsubData?: () => void;
    private unsubSelection?: () => void;
    private scrollFrame: number | null = null;

    // A panel whose container is its own scroll box (bytecode, stack) moves its
    // anchored row without the window scrolling, and element scroll events do
    // not bubble to window — so the orchestrator's window listener never sees
    // it and the connector layer's cached rect goes stale. Re-measure here.
    // rAF-coalesced: scroll fires far more often than a redraw is useful,
    // and this runs during touch momentum scrolling.
    private scrollHandler = () => {
        if (this.scrollFrame !== null) return;
        this.scrollFrame = requestAnimationFrame(() => {
            this.scrollFrame = null;
            this.refreshAnchor();
        });
    };

    constructor(
        protected container: HTMLElement,
        protected dataStore: VizDataStore,
        protected selectionStore: Store<VizSelection>,
        protected connectors: ConnectorLayer,
    ) {
        // autoSetUp = false: Component must not call setUp() during super(),
        // because the protected fields above are only assigned after super()
        // returns. The orchestrator drives setUp() explicitly.
        super([], false);
    }

    setUp() {
        if (this.didSetUp) return;
        this.didSetUp = true;

        this.renderContainer();

        // Subscribe first (future changes)...
        this.unsubData = this.dataStore.subscribe((s) => {
            if (s.data) { this.markFilled(); this.onDataChange(s.data); }
        });
        this.unsubSelection = this.selectionStore.subscribe((s) => this.onSelectionChange(s));

        // ...then prime from current state, since data may have arrived before
        // this panel mounted. onDataChange runs only when data is present.
        const current = this.dataStore.get().data;
        if (current) { this.markFilled(); this.onDataChange(current); }
        this.onSelectionChange(this.selectionStore.get());

        // Harmless on panels that never scroll: refreshAnchor defaults to a no-op.
        this.container.addEventListener('scroll', this.scrollHandler, { passive: true });

        super.setUp();
    }

    tearDown() {
        this.container.removeEventListener('scroll', this.scrollHandler);
        if (this.scrollFrame !== null) {
            cancelAnimationFrame(this.scrollFrame);
            this.scrollFrame = null;
        }
        this.unsubData?.();
        this.unsubSelection?.();
        this.unsubData = undefined;
        this.unsubSelection = undefined;
        this.didSetUp = false;
        super.tearDown();
    }

    // React to a selection change. After updating its DOM, a panel should call
    // this.setAnchor(rect | null) to publish its connector anchor.
    abstract onSelectionChange(state: VizSelection): void;

    // (Re-)render from a fresh derived snapshot.
    abstract onDataChange(data: VizData): void;

    // Publish (or clear) this panel's connector anchor.
    protected setAnchor(rect: DOMRect | null) {
        this.connectors.setAnchor(this.panelId, rect);
    }

    // Re-measure and re-publish the current anchor without changing selection.
    // Called on scroll/resize, when cached connector rects go stale. Default is
    // a no-op; panels with a live anchor override it.
    refreshAnchor(): void {}

    protected markFilled(): void {
        delete this.container.dataset.empty;
    }

    // Shared container chrome. The existing CSS targets panel ids directly, so
    // this only adds a stable marker class without disturbing panel markup.
    private renderContainer() {
        panelSelection(this.container).classed('lox-panel', true);
        this.container.dataset.empty = '';
    }
}
