// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { select } from 'd3';

interface RectLike {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
}

interface Endpoints {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
}

interface LineDatum {
    fromId: string;
    toId: string;
    color: string;
}

// Pure geometry helper: pick the line endpoints between two rects.
// Ported verbatim from the old connector.ts drawConnector edge-selection.
export function computeEndpoints(from: RectLike, to: RectLike): Endpoints {
    const x1 = from.left + from.width / 2;
    const x2 = to.left + to.width / 2;
    let y1: number, y2: number;

    if (from.top > to.bottom) {
        y1 = from.top;
        y2 = to.bottom;
    } else if (from.bottom < to.top) {
        y1 = from.bottom;
        y2 = to.top;
    } else {
        y1 = from.top + from.height / 2;
        y2 = to.top + to.height / 2;
    }

    return { x1, y1, x2, y2 };
}

export class ConnectorLayer {
    private overlay = select(document.body)
        .append('svg')
        .style('position', 'fixed')
        .style('top', '0')
        .style('left', '0')
        .style('width', '100vw')
        .style('height', '100vh')
        .style('pointer-events', 'none')
        .style('z-index', '9999');
    private anchors = new Map<string, DOMRect | null>();
    private lineData: LineDatum[] = [];

    constructor(_container: Element) {
        // Container reserved for future use (e.g. container-relative positioning).
        // The overlay is appended to document.body since rects come from
        // getBoundingClientRect() (viewport coordinates), so a position:fixed
        // full-viewport overlay needs no coordinate translation.
    }

    addLine(fromId: string, toId: string, color: string): void {
        this.lineData.push({ fromId, toId, color });

        if (!this.anchors.has(fromId)) this.anchors.set(fromId, null);
        if (!this.anchors.has(toId)) this.anchors.set(toId, null);
    }

    setAnchor(panelId: string, rect: DOMRect | null): void {
        this.anchors.set(panelId, rect);
        this.redraw();
    }

    redraw(): void {
        this.overlay
            .selectAll<SVGLineElement, LineDatum>('line')
            .data(this.lineData, (d) => `${d.fromId}:${d.toId}`)
            .join('line')
            .each((d, i, nodes) => {
                const line = select(nodes[i]);
                const from = this.anchors.get(d.fromId) ?? null;
                const to = this.anchors.get(d.toId) ?? null;

                if (from === null || to === null) {
                    line.style('display', 'none');
                    return;
                }

                const { x1, y1, x2, y2 } = computeEndpoints(from, to);
                line
                    .attr('x1', x1)
                    .attr('y1', y1)
                    .attr('x2', x2)
                    .attr('y2', y2)
                    .attr('stroke', d.color)
                    .attr('stroke-width', 2)
                    .attr('stroke-dasharray', '4 3')
                    .style('display', null);
            });
    }

    refresh(): void {
        this.redraw();
    }

    destroy(): void {
        this.overlay.remove();
        this.anchors.clear();
        this.lineData = [];
    }
}
