// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { select, Selection } from 'd3';

export type PanelSelection = Selection<any, unknown, HTMLElement, unknown>;

/** Panel-owned DOM is built and updated through d3 selections. */
export function panelSelection(container: HTMLElement): PanelSelection {
    return select(container) as unknown as PanelSelection;
}

/** Remove all child nodes from a panel container. */
export function clearContainer(container: HTMLElement): void {
    panelSelection(container).selectAll('*').remove();
}

// Scroll `el` into view within `container` only. Element.scrollIntoView walks
// every scrollable ancestor including the document, so a panel-internal reveal
// drags the whole page with it; this adjusts container.scrollTop and nothing
// else. No-op when `el` is already fully visible, matching block: 'nearest'.
export function scrollIntoViewWithin(el: HTMLElement, container: HTMLElement): void {
    const box = container.getBoundingClientRect();
    const target = el.getBoundingClientRect();

    if (target.top < box.top) {
        container.scrollTop += target.top - box.top;
    } else if (target.bottom > box.bottom) {
        // Never push the top of `el` above the top of the box: for an element
        // taller than the container, aligning the top is the useful half.
        container.scrollTop += Math.min(target.bottom - box.bottom, target.top - box.top);
    }
}

/** Narrow d3's BaseType (.node() may be Window, Document, etc.) to Element | null. */
export function selectionNode(source: { node(): unknown }): Element | null {
    const node = source.node();
    return node instanceof Element ? node : null;
}

/** Narrow a d3 selection's bound node to a specific element type, or null. */
export function selectionElement<T extends Element>(
    source: { node(): unknown },
): T | null {
    const node = source.node();
    return node instanceof Element ? (node as T) : null;
}
