// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { createLox } from '@/lox-visualizer/lox-core';
import { Component } from '@/lib/component';
import { setupStyles } from '@/lib/styles';
import { createStore } from '@/lib/store';
import type { Store } from '@/lib/store';
import { ConnectorLayer } from '@/compiler-viz/connector-layer';
import { deriveVizData, publishConsoleMessages } from '@/lox-visualizer/lox-data';
import type { ConsoleStore, VizData, VizDataStore, VizSelection } from '@/compiler-viz/types';
import { INITIAL_EXECUTION_STATE } from '@/compiler-viz/execution';
import type { ExecutionStore, TaggedPrint, VmStep } from '@/compiler-viz/execution';
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
import { EditorSlot } from '@/compiler-viz/slots/editor-slot';
import { LOX_TOKEN_CATEGORY_MAP } from '@/lox-visualizer/token-map';
import { DEFAULT_SAMPLE_LABEL, loxSamples } from '@/lox-visualizer/samples';
import { SamplePicker } from '@/compiler-viz/sample-picker';
import { colors } from '@/compiler-viz/theme';
import type { ConsoleMessage } from '@/compiler-viz/types';
import { NODE_TYPE, PARSER_ACTIONS, LoxState, mapTokenType } from '@/lox-visualizer/state/state';

declare global {
    interface Window {
        LOX_STATE: LoxState;
    }
}

// Orchestrator. Four responsibilities: (1) create the WASM instance and run
// source, (2) accumulate WASM events into LoxState and publish the derived
// snapshot to the data store when a run finishes, (3) own the stores, connector
// layer and panels, (4) drive the editor and re-run. All cross-panel selection,
// highlight and connector drawing live in the panels + the connector layer.
const MAX_STEPS = 10_000;

export class LoxVisualizer extends Component {
    private dataStore: VizDataStore;
    private consoleStore: ConsoleStore;
    private selection: Store<VizSelection>;
    private executionStore: ExecutionStore;
    private stepBuffer: VmStep[] = [];
    private printBuffer: TaggedPrint[] = [];
    private stepCount = 0;
    private root: HTMLElement;
    private connectors: ConnectorLayer;
    private panels: VisualizationPanel[];
    private editor: EditorSlot | null;
    private initialDoc: string;
    // Each entry is an unsubscribe function for an inter-mode mutual-exclusion
    // subscription. Extend here when adding new focus modes.
    private unsubModes: Array<() => void> = [];

    private loxState!: LoxState;
    private lox!: Awaited<ReturnType<typeof createLox>>;
    private rendered = false;

    // Re-measure each panel's anchor and redraw connectors (rects move on
    // scroll/resize; the connector layer caches rects, so panels re-publish).
    private refreshHandler = () => {
        for (const panel of this.panels) panel.refreshAnchor();
    };

    // Any click that isn't on a selectable element clears the shared selection;
    // each panel reacts via onSelectionChange. Selectable elements (lexer
    // tokens, AST nodes, bytecode rows) call stopPropagation so their clicks
    // never reach this handler — so a click that does reach here (panel
    // whitespace, AST empty space, or anywhere outside) is a deselect.
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
        this.panels = children.filter((child): child is VisualizationPanel => child instanceof VisualizationPanel);
        this.editor = children.find((child): child is EditorSlot => child instanceof EditorSlot) ?? null;
    }

    /** Mount the layout DOM into the page's container and construct the app. */
    static mount(
        container: HTMLElement,
        initialDoc: string,
        layout: VisualizerLayout = DEFAULT_LAYOUT,
    ): LoxVisualizer {
        const mountResult = mountVisualizerInto(container, layout);
        const dataStore = createStore<{ data: VizData | null }>({ data: null });
        const consoleStore = createStore<{ messages: ConsoleMessage[] }>({ messages: [] });
        const selection = createStore<VizSelection>({ selectedStart: null, selectedAstNode: null });
        const executionStore = createStore(INITIAL_EXECUTION_STATE);
        const connectors = new ConnectorLayer(mountResult.root);

        let instance: LoxVisualizer | null = null;
        const ctx: PanelContext = {
            dataStore,
            consoleStore,
            selectionStore: selection,
            executionStore,
            connectors,
            root: mountResult.root,
            initialDoc,
            onRun: (text) => instance!.rerun(text),
        };

        declareConnectors(connectors, layout, colors.highlight);
        if (layoutIncludes(layout, 'bytecode') && layoutIncludes(layout, 'ast')) {
            connectors.addLine('bc-exec', 'ast-exec', '#f90');
        }
        const registry = createDefaultPanelRegistry(ctx, LOX_TOKEN_CATEGORY_MAP);
        const layoutChildren = createLayoutChildren(layout, mountResult.containers, registry);
        const children = [...layoutChildren];

        const editorSlot = layoutChildren.find((child): child is EditorSlot => child instanceof EditorSlot);
        if (editorSlot) {
            const pickerEl = mountResult.root.querySelector<HTMLElement>('.lox-sample-picker-bar')!;
            children.push(new SamplePicker(
                pickerEl,
                loxSamples,
                (text) => editorSlot.setText(text),
                DEFAULT_SAMPLE_LABEL,
            ));
        }

        instance = new LoxVisualizer(mountResult.root, initialDoc, dataStore, consoleStore, selection, executionStore, connectors, children);
        return instance;
    }

    private publishConsole() {
        publishConsoleMessages(this.consoleStore, this.loxState.get('consoleMessages'));
    }

    async setUp() {
        this.root.dataset.running = '';
        const lox = await createLox();
        this.lox = lox;

        this.loxState = new LoxState();
        window.LOX_STATE = this.loxState;

        this.rendered = false;

        setupStyles('/css/lox-visualizer.css');

        lox.events.on('stdout', (event) => this.loxState.push('stdout', event));

        lox.events.on('print', (event) => {
            this.printBuffer.push({
                text: event.text,
                stepIndex: this.stepCount,
                srcOffset: event.src_offset,
                chunk: event.chunk,
                offset: event.offset,
            });
        });

        lox.events.on('stderr', (text) => {
            this.loxState.push('consoleMessages', { type: 'error', text });
            this.publishConsole();
        });

        lox.events.on('lexer', (event) => {
            this.loxState.push('lexerEvents', event);

            if (mapTokenType(event.type) !== 'TOKEN_EOF' || this.rendered) return;

            this.rendered = true;
            window.requestAnimationFrame(() => this.render());
        });

        lox.events.on('parser', (event) => {
            if (event.node_type === NODE_TYPE.PROGRAM) {
                if (event.action === PARSER_ACTIONS.OPEN) {
                    this.loxState.emptyArray('parserEvents');
                } else if (event.action === PARSER_ACTIONS.CLOSE) {
                    window.requestAnimationFrame(() => this.render());
                }
            } else {
                this.loxState.push('parserEvents', event);
            }
        });

        lox.events.on('compiler', (event) => {
            this.loxState.push('compilerEvents', event);
        });

        lox.events.on('vm_step', (event) => {
            if (this.stepBuffer.length < MAX_STEPS) this.stepBuffer.push(event);
            this.stepCount++;
        });

        this.loxState.set('text', this.initialDoc);

        // Mutual exclusion between focus modes. Registered before super.setUp() so
        // these fire before panel subscribers — state is consistent by the time
        // panels react. Add a new pair here when introducing a third focus mode.
        this.unsubModes = [
            this.selection.subscribe((state) => {
                if (state.selectedStart !== null) this.executionStore.set({ active: false });
            }),
            this.executionStore.subscribe((state) => {
                if (state.active) this.selection.set({ selectedStart: null, selectedAstNode: null });
            }),
        ];

        // Subscribe panels (and prime them) before the first render publishes data.
        super.setUp();

        lox.exports.runSource(this.getText());
        delete this.root.dataset.running;
        this.executionStore.set({
            steps: this.stepBuffer,
            prints: this.printBuffer,
            currentStep: this.stepBuffer.length > 0 ? 0 : null,
        });
        if (this.stepBuffer.length >= MAX_STEPS) {
            this.loxState.push('consoleMessages', {
                type: 'error',
                text: `Execution trace capped at ${MAX_STEPS.toLocaleString()} steps — program may have an infinite loop.`,
            });
            this.publishConsole();
        }

        window.addEventListener('resize', this.refreshHandler);
        window.addEventListener('scroll', this.refreshHandler);
        document.addEventListener('click', this.documentClickHandler);
    }

    tearDown() {
        for (const unsub of this.unsubModes) unsub();
        this.unsubModes = [];
        delete this.root.dataset.running;
        super.tearDown();
        window.removeEventListener('resize', this.refreshHandler);
        window.removeEventListener('scroll', this.refreshHandler);
        document.removeEventListener('click', this.documentClickHandler);
        this.connectors.destroy();
    }

    rerun(text: string) {
        this.rendered = false;
        this.stepBuffer = [];
        this.printBuffer = [];
        this.stepCount = 0;
        this.executionStore.set({ steps: [], prints: [], currentStep: null, playing: false, active: false });
        this.loxState.set('text', text);
        this.loxState.emptyArray('lexerEvents');
        this.loxState.emptyArray('compilerEvents');
        this.loxState.emptyArray('consoleMessages');
        this.publishConsole();
        this.root.dataset.running = '';
        this.lox.exports.runSource(text);
        delete this.root.dataset.running;
        this.executionStore.set({
            steps: this.stepBuffer,
            prints: this.printBuffer,
            currentStep: this.stepBuffer.length > 0 ? 0 : null,
        });
        if (this.stepBuffer.length >= MAX_STEPS) {
            this.loxState.push('consoleMessages', {
                type: 'error',
                text: `Execution trace capped at ${MAX_STEPS.toLocaleString()} steps — program may have an infinite loop.`,
            });
            this.publishConsole();
        }
    }

    getText() {
        return this.editor?.getText() ?? this.initialDoc;
    }

    render() {
        // Reset selection first so panels clear highlights/anchors before the
        // data re-render replaces their DOM, then publish the fresh snapshot.
        this.selection.set({ selectedStart: null, selectedAstNode: null });
        this.dataStore.set({ data: deriveVizData(this.loxState) });
    }
}
