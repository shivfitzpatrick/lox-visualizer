import { select } from 'd3';
import {
    LOX_PANE_CLASS,
    LOX_PANEL_CLASS,
    LOX_PANEL_LABEL_CLASS,
    LOX_SAMPLE_PICKER_BAR_CLASS,
    LOX_VISUALIZER_APP_CLASS,
    LOX_VISUALIZER_CLASS,
    LOX_VISUALIZER_ROW_CLASS,
    panelClass,
    panelLabel,
    panelShellId,
    validateLayout,
} from '@/compiler-viz/layout';
import type { MountResult, PanelKind, VisualizerLayout } from '@/compiler-viz/layout';
import { selectionElement } from '@/compiler-viz/d3-utils';

export function buildLayoutDOM(
    layout: VisualizerLayout,
    options?: { rootClass?: string },
): {
    root: HTMLElement;
    containers: Map<PanelKind, HTMLElement>;
} {
    const normalized = validateLayout(layout);
    const rootSel = select(document.createElement('div'))
        .classed(options?.rootClass ?? LOX_VISUALIZER_CLASS, true);

    // Sits above the panes so its height can't skew pane alignment;
    // stays empty unless a SamplePicker is mounted into it.
    rootSel.append('div').classed(LOX_SAMPLE_PICKER_BAR_CLASS, true);

    const appSel = rootSel.append('div').classed(LOX_VISUALIZER_APP_CLASS, true);
    const containers = new Map<PanelKind, HTMLElement>();

    for (const row of normalized) {
        const rowSel = appSel.append('div').classed(LOX_VISUALIZER_ROW_CLASS, true);

        for (const kind of row) {
            const paneSel = rowSel.append('div').classed(LOX_PANE_CLASS, true);

            paneSel.append('div')
                .classed(LOX_PANEL_LABEL_CLASS, true)
                .text(panelLabel(kind));

            const shellSel = paneSel.append('div')
                .classed(LOX_PANEL_CLASS, true)
                .classed(panelClass(kind), true)
                .attr('id', panelShellId(kind));

            const shell = selectionElement<HTMLElement>(shellSel);
            if (shell) containers.set(kind, shell);
        }
    }

    const root = selectionElement<HTMLElement>(rootSel);
    if (!root) throw new Error('buildLayoutDOM: failed to create root element');

    return { root, containers };
}

/**
 * Mount the layout DOM inside a page-provided container (the post supplies an
 * empty div; the caller supplies the initial editor document separately).
 */
export function mountVisualizerInto(container: HTMLElement, layout: VisualizerLayout): MountResult {
    const { root, containers } = buildLayoutDOM(layout);
    // replaceChildren, not append: mounting twice replaces rather than stacks.
    container.replaceChildren(root);
    return { root, containers };
}
