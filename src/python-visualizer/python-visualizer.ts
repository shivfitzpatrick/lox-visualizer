import { select } from 'd3';

import { Component } from '@/lib/component';
import { setupStyles } from '@/lib/styles';
import { createStore } from '@/lib/store';
import type { Store } from '@/lib/store';
import { INITIAL_EXECUTION_STATE } from '@/compiler-viz/execution';
import type { ExecutionStore } from '@/compiler-viz/execution';
import { ConnectorLayer } from '@/compiler-viz/connector-layer';
import type { ConsoleMessage, ConsoleStore, VizData, VizDataStore, VizSelection } from '@/compiler-viz/types';
import { VisualizationPanel } from '@/compiler-viz/visualization-panel';
import {
    createDefaultPanelRegistry,
    createLayoutChildren,
    declareConnectors,
    DEFAULT_LAYOUT,
    layoutIncludes,
} from '@/compiler-viz/layout';
import type { PanelContext, VisualizerLayout } from '@/compiler-viz/layout';
import { mountVisualizerInto } from '@/compiler-viz/mount';
import { publishConsoleMessages } from '@/lox-visualizer/lox-data';
import { colors } from '@/compiler-viz/theme';

import { deriveVizData, PYTHON_TOKEN_CATEGORY_MAP } from '@/python-visualizer/py-data';
import { loadPyCore } from '@/python-visualizer/py-core';
import type { PyCore } from '@/python-visualizer/py-core';
import defaultSource from '@/python-visualizer/sample.py?raw';

/** The program the editor opens on. A samples store like the Lox one can
 *  wait until this visualizer is published. */
export const DEFAULT_PYTHON_SOURCE = defaultSource;

const MAX_STEPS = 10_000;

// Work in progress: nothing imports this yet, so it is not bundled or served.
// It mounts exactly like the Lox visualizer, so wiring it up once the language
// tabs move into the app is a container lookup and a mount() call.
export class PythonVisualizer extends Component {
    private dataStore: VizDataStore;
    private consoleStore: ConsoleStore;
    private selection: Store<VizSelection>;
    private executionStore: ExecutionStore;
    private connectors: ConnectorLayer;
    private panels: VisualizationPanel[];
    private root: HTMLElement;
    private initialDoc: string;
    private pyCore: PyCore | null = null;
    private unsubModes: Array<() => void> = [];

    private refreshHandler = () => {
        for (const panel of this.panels) panel.refreshAnchor();
    };

    private documentClickHandler = () => {
        this.selection.set({ selectedStart: null, selectedAstNode: null });
        this.executionStore.set({ active: false });
    };

    private constructor(
        root: HTMLElement,
        initialDoc: string,
        dataStore: VizDataStore,
        consoleStore: ConsoleStore,
        selection: Store<VizSelection>,
        executionStore: ExecutionStore,
        connectors: ConnectorLayer,
        children: Component[],
    ) {
        super(children, false);
        this.root = root;
        this.initialDoc = initialDoc;
        this.dataStore = dataStore;
        this.consoleStore = consoleStore;
        this.selection = selection;
        this.executionStore = executionStore;
        this.connectors = connectors;
        this.panels = children.filter(
            (c): c is VisualizationPanel => c instanceof VisualizationPanel,
        );
    }

    static mount(
        container: HTMLElement,
        initialDoc: string,
        layout: VisualizerLayout = DEFAULT_LAYOUT,
    ): PythonVisualizer {
        const mountResult = mountVisualizerInto(container, layout);
        const dataStore = createStore<{ data: VizData | null }>({ data: null });
        const consoleStore = createStore<{ messages: ConsoleMessage[] }>({ messages: [] });
        const selection = createStore<VizSelection>({ selectedStart: null, selectedAstNode: null });
        const executionStore = createStore(INITIAL_EXECUTION_STATE);
        const connectors = new ConnectorLayer(mountResult.root);

        let instance: PythonVisualizer | null = null;
        const ctx: PanelContext = {
            dataStore,
            consoleStore,
            selectionStore: selection,
            executionStore,
            connectors,
            root: mountResult.root,
            initialDoc,
            onRun: (text) => instance!.run(text),
        };

        declareConnectors(connectors, layout, colors.highlight);
        if (layoutIncludes(layout, 'bytecode') && layoutIncludes(layout, 'ast')) {
            connectors.addLine('bc-exec', 'ast-exec', '#f90');
        }
        const registry = createDefaultPanelRegistry(ctx, PYTHON_TOKEN_CATEGORY_MAP);
        const children = createLayoutChildren(layout, mountResult.containers, registry);

        instance = new PythonVisualizer(
            mountResult.root,
            initialDoc,
            dataStore,
            consoleStore,
            selection,
            executionStore,
            connectors,
            children,
        );
        return instance;
    }

    async setUp() {
        setupStyles('/css/lox-visualizer.css');

        this.unsubModes = [
            this.selection.subscribe((state) => {
                if (state.selectedStart !== null) this.executionStore.set({ active: false });
            }),
            this.executionStore.subscribe((state) => {
                if (state.active) this.selection.set({ selectedStart: null, selectedAstNode: null });
            }),
        ];

        super.setUp();

        window.addEventListener('resize', this.refreshHandler);
        window.addEventListener('scroll', this.refreshHandler);
        document.addEventListener('click', this.documentClickHandler);

        this.setLoading(true);
        try {
            this.pyCore = await loadPyCore();
        } catch (e) {
            this.pushError(`Pyodide failed to load: ${String(e)}`);
            this.setLoading(false);
            return;
        }
        this.setLoading(false);
        this.run(this.initialDoc);
    }

    tearDown() {
        for (const unsub of this.unsubModes) unsub();
        this.unsubModes = [];
        super.tearDown();
        window.removeEventListener('resize', this.refreshHandler);
        window.removeEventListener('scroll', this.refreshHandler);
        document.removeEventListener('click', this.documentClickHandler);
        this.connectors.destroy();
    }

    run(source: string) {
        if (!this.pyCore) return;

        this.selection.set({ selectedStart: null, selectedAstNode: null });
        this.executionStore.set({ steps: [], prints: [], currentStep: null, playing: false });
        publishConsoleMessages(this.consoleStore, []);

        const result = this.pyCore.run(source);
        if (!result.ok) {
            this.pushError(result.error);
            this.dataStore.set({ data: null });
            return;
        }

        const { data } = result;
        this.dataStore.set({ data: deriveVizData(data) });

        const steps = data.steps ?? [];
        const prints = data.prints ?? [];

        this.executionStore.set({
            steps,
            prints,
            currentStep: steps.length > 0 ? 0 : null,
            playing: false,
        });

        const errors: ConsoleMessage[] = [];
        if (data.exec_error) {
            errors.push({ type: 'error', text: data.exec_error });
        }
        if (data.steps_capped || steps.length >= MAX_STEPS) {
            errors.push({
                type: 'error',
                text: `Execution trace capped at ${MAX_STEPS.toLocaleString()} steps — program may have an infinite loop.`,
            });
        }

        if (steps.length > 0) {
            publishConsoleMessages(this.consoleStore, errors);
        } else {
            const consoleMsgs: ConsoleMessage[] = [
                ...errors,
                ...(data.console ?? []).map((m) =>
                    m.type === 'print'
                        ? { type: 'print' as const, text: m.text, srcOffset: m.src_offset }
                        : { type: 'error' as const, text: m.text },
                ),
            ];
            publishConsoleMessages(this.consoleStore, consoleMsgs);
        }
    }

    private setLoading(loading: boolean) {
        select(this.root).classed('py-loading', loading);
    }

    private pushError(text: string) {
        publishConsoleMessages(this.consoleStore, [{ type: 'error', text }]);
    }
}
