import { Component } from '@/lib/component';
import type { Store } from '@/lib/store';
import type { ConnectorLayer } from '@/compiler-viz/connector-layer';
import type { ConsoleStore, VizDataStore, VizSelection } from '@/compiler-viz/types';
import type { ExecutionStore } from '@/compiler-viz/execution';
import { VisualizationPanel } from '@/compiler-viz/visualization-panel';

export type PanelKind = 'editor' | 'lexer' | 'ast' | 'bytecode' | 'console' | 'stack' | 'playback';

/** One horizontal row of panes. Empty rows are skipped by validateLayout. */
export type LayoutRow = PanelKind[];

/** Full page layout: row 0 is top. */
export type VisualizerLayout = LayoutRow[];

/** Default for the cloxvis post — editor+lexer share row 1. */
export const DEFAULT_LAYOUT: VisualizerLayout = [
    ['editor', 'lexer'],
    ['ast'],
    ['playback'],
    ['bytecode', 'stack'],
    ['console'],
];

/** Parse a compact layout string: rows separated by `|`, panes in a row by `,`. */
export function parseDataLayout(value: string): VisualizerLayout {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error('Empty data-layout attribute');
    }

    const rows: LayoutRow[] = trimmed.split('|').map((row) =>
        row
            .split(',')
            .map((kind) => kind.trim())
            .filter((kind) => kind.length > 0) as PanelKind[],
    );

    return validateLayout(rows);
}

/** Shared wiring every pane receives. */
export interface PanelContext {
    dataStore: VizDataStore;
    consoleStore: ConsoleStore;
    selectionStore: Store<VizSelection>;
    executionStore: ExecutionStore;
    connectors: ConnectorLayer;
    /** The .lox-visualizer element (connector overlay parent). */
    root: HTMLElement;
    /** Initial editor document (the default sample, supplied by the entry). */
    initialDoc: string;
    onRun: (text: string) => void;
}

/** Factory for VisualizationPanel subclasses. */
export type VizPanelFactory = (
    kind: Exclude<PanelKind, 'editor' | 'console'>,
    container: HTMLElement,
    ctx: PanelContext,
) => VisualizationPanel;

/** Lifecycle for non-viz slots (editor, console). */
export interface VisualizerSlot extends Component {
    readonly slotId: PanelKind;
}

export type PanelInstance = VisualizationPanel | VisualizerSlot;

export type PanelFactory = (container: HTMLElement) => PanelInstance;

export type PanelRegistry = Map<PanelKind, PanelFactory>;

/** Result of mountVisualizerInto (implemented in mount.ts — 10). */
export interface MountResult {
    root: HTMLElement;
    containers: Map<PanelKind, HTMLElement>;
}

/** DOM class naming — settled in 09; downstream streams must use these. */
export const LOX_VISUALIZER_CLASS = 'lox-visualizer';
export const LOX_VISUALIZER_APP_CLASS = 'lox-visualizer-app';
export const LOX_SAMPLE_PICKER_BAR_CLASS = 'lox-sample-picker-bar';
export const LOX_VISUALIZER_ROW_CLASS = 'lox-visualizer-row';
export const LOX_PANE_CLASS = 'lox-pane';
export const LOX_PANEL_CLASS = 'lox-panel';
export const LOX_PANEL_LABEL_CLASS = 'lox-panel-label';

const PANEL_KINDS: readonly PanelKind[] = ['editor', 'lexer', 'ast', 'bytecode', 'console', 'stack', 'playback'];

export const PANEL_LABELS: Readonly<Record<PanelKind, string>> = {
    editor: 'Source',
    lexer: 'Lexer',
    ast: 'Parser',
    bytecode: 'Bytecode',
    stack: 'Stack',
    console: 'Output',
    playback: 'Playback',
};

export function isPanelKind(value: string): value is PanelKind {
    return (PANEL_KINDS as readonly string[]).includes(value);
}

export function panelClass(kind: PanelKind): string {
    return `lox-panel--${kind}`;
}

export function panelLabel(kind: PanelKind): string {
    return PANEL_LABELS[kind];
}

/** Stable shell id for debugging; bytecode keeps the legacy lox-compiler id. */
export function panelShellId(kind: PanelKind): string {
    if (kind === 'bytecode') return 'lox-compiler';
    return `lox-${kind}`;
}

export function validateLayout(layout: VisualizerLayout): VisualizerLayout {
    const seen = new Set<PanelKind>();
    const normalized: VisualizerLayout = [];

    for (const row of layout) {
        const kinds: PanelKind[] = [];
        for (const kind of row) {
            if (!isPanelKind(kind)) {
                throw new Error(`Unknown panel kind: ${String(kind)}`);
            }
            if (seen.has(kind)) {
                throw new Error(`Duplicate panel kind in layout: ${kind}`);
            }
            seen.add(kind);
            kinds.push(kind);
        }
        if (kinds.length > 0) {
            normalized.push(kinds);
        }
    }

    return normalized;
}

/** Flat list of pane kinds in layout order (row-major). */
export function kindsInLayout(layout: VisualizerLayout): PanelKind[] {
    return validateLayout(layout).flat();
}

export function layoutIncludes(layout: VisualizerLayout, kind: PanelKind): boolean {
    return kindsInLayout(layout).includes(kind);
}

/** Instantiate one Component per pane in layout order. */
export function createLayoutChildren(
    layout: VisualizerLayout,
    containers: Map<PanelKind, HTMLElement>,
    registry: PanelRegistry,
): Component[] {
    const children: Component[] = [];

    for (const kind of kindsInLayout(layout)) {
        const container = containers.get(kind);
        if (!container) {
            throw new Error(`Missing container for panel kind: ${kind}`);
        }
        const factory = registry.get(kind);
        if (!factory) {
            throw new Error(`No factory for panel kind: ${kind}`);
        }
        children.push(factory(container));
    }

    return children;
}

/** Which connector lines to register for a layout (pure — testable without DOM). */
export function connectorLinesForLayout(
    layout: VisualizerLayout,
): Array<{ from: string; to: string }> {
    const kinds = new Set(kindsInLayout(layout));
    const lines: Array<{ from: string; to: string }> = [];

    if (kinds.has('ast') && kinds.has('lexer')) {
        lines.push({ from: 'ast', to: 'lexer' });
    }
    if (kinds.has('ast') && kinds.has('bytecode')) {
        lines.push({ from: 'ast', to: 'bc' });
    }
    if (kinds.has('console') && kinds.has('bytecode')) {
        lines.push({ from: 'console', to: 'bc' });
    }

    return lines;
}

import type { TokenCategoryMap } from '@/lox-visualizer/token-map';
import { LexerPanel } from '@/compiler-viz/panels/lexer-panel';
import { AstPanel } from '@/compiler-viz/panels/ast-panel';
import { BytecodePanel } from '@/compiler-viz/panels/bytecode-panel';
import { ConsolePanel } from '@/compiler-viz/panels/console-panel';
import { StackPanel } from '@/compiler-viz/panels/stack-panel';
import { PlaybackControls } from '@/compiler-viz/panels/playback-controls';
import { EditorSlot } from '@/compiler-viz/slots/editor-slot';

/** Build the standard four-panel registry. Pass a language-specific tokenMap; Python will supply its own. */
export function createDefaultPanelRegistry(
    ctx: PanelContext,
    tokenMap: TokenCategoryMap,
): PanelRegistry {
    const registry: PanelRegistry = new Map();

    registry.set(
        'lexer',
        (container) =>
            new LexerPanel(container, ctx.dataStore, ctx.selectionStore, ctx.connectors, tokenMap),
    );
    registry.set(
        'ast',
        (container) => new AstPanel(container, ctx.dataStore, ctx.selectionStore, ctx.connectors, ctx.executionStore),
    );
    registry.set(
        'bytecode',
        (container) => new BytecodePanel(container, ctx.dataStore, ctx.selectionStore, ctx.connectors, ctx.executionStore),
    );
    registry.set(
        'editor',
        (container) => new EditorSlot(container, ctx.initialDoc, ctx.onRun),
    );
    registry.set(
        'console',
        (container) =>
            new ConsolePanel(
                container,
                ctx.dataStore,
                ctx.consoleStore,
                ctx.selectionStore,
                ctx.connectors,
                ctx.executionStore,
            ),
    );
    registry.set(
        'stack',
        (container) => new StackPanel(container, ctx.executionStore),
    );
    registry.set(
        'playback',
        (container) => new PlaybackControls(container, ctx.executionStore),
    );

    return registry;
}

/** Register connector lines only when both endpoint panes appear in the layout. */
export function declareConnectors(
    connectors: ConnectorLayer,
    layout: VisualizerLayout,
    highlightColor: string,
): void {
    for (const line of connectorLinesForLayout(layout)) {
        connectors.addLine(line.from, line.to, highlightColor);
    }
}
