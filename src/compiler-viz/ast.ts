// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { drag, hierarchy, tree, zoom, zoomIdentity, ZoomTransform, zoomTransform as getZoomTransform, interpolateNumber, select } from 'd3';
import type { HierarchyNode } from 'd3-hierarchy';
import { selectionNode, type PanelSelection } from '@/compiler-viz/d3-utils';
import { ColorScheme } from '@/lox-visualizer/state/token';

export type ChildType = string | null;

interface AstNodeSelf {
    type: string;
    childType: ChildType;
    start?: number;
    attrs: {
      [key: string]: string | string[] | undefined;
    };
    // Source offsets for attrs populated from ATTR / PUSHATTR parser events.
    attrStarts?: {
      [key: string]: number | number[];
    };
}

export interface AstNode extends AstNodeSelf {
  children: AstNode[];
}

export type NavDirection = 'left' | 'right' | 'up' | 'down';

export type AstHandle = ((start: number) => void) & {
    getSelectedNode(): AstNode | null;
    getSelectedNodeRect(): DOMRect | null;
    findByStart(start: number): AstNode | null;
    clearFocus(): void;
    moveDirection(dir: NavDirection): void;
    canMove(dir: NavDirection): boolean;
    isNavigating(): boolean;
    destroy(): void;
};

function measureContainer(el: HTMLElement): { width: number; height: number } {
    const width = Math.max(el.clientWidth || 800, 280);
    const rawHeight = el.clientHeight || 0;
    const height = Math.max(
        Math.min(Math.max(rawHeight, 240), Math.round(window.innerHeight * 0.4)),
        240,
    );
    return { width, height };
}

export function adjacentNode(
    root: HierarchyNode<AstNode>,
    current: HierarchyNode<AstNode>,
    direction: NavDirection,
): HierarchyNode<AstNode> | null {
    if (direction === 'up') return current.parent;
    if (direction === 'down') return current.children?.[0] ?? null;

    const level = root.descendants()
        .filter((d) => d.depth === current.depth)
        .sort((a, b) => a.x! - b.x!);
    const idx = level.indexOf(current);
    if (direction === 'left') return level[idx - 1] ?? null;
    return level[idx + 1] ?? null;
}

export function drawAst(
    container: PanelSelection,
    data: AstNode,
    colors: ColorScheme,
    onHighlight?: (node: AstNode | null, astEl: Element | null) => void,
): AstHandle {
    const containerEl = container.node();
    if (!containerEl) {
        throw new Error('drawAst: missing container element');
    }

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let config = measureContainer(containerEl);

    container.selectAll('svg').remove();

    const svg = container
	  .append('svg')
	  .attr('width', config.width + 20)
	  .attr('height', config.height + 20);

    const g = svg.append('g');
    g.append('g').classed('nodes', true);
    g.append('g').classed('links', true);

    const z = zoom<SVGSVGElement, unknown>()
	  .scaleExtent([0.2, 2])
	  .on('start', () => {
	      if (!programmaticZoom) {
		  // User-initiated gesture: deselect and notify other panels.
		  focusedHNode = null;
		  setHighlight(null);
		  onHighlight?.(null, null);
	      }
	  })
	  .on('zoom', (event) => { g.attr('transform', event.transform); })
	  .on('end', () => {
	      // For user gestures, re-publish selection if a node was focused
	      // before the gesture began (unlikely since 'start' clears it, but
	      // guards against edge cases). For programmatic zooms, onComplete
	      // handles the re-publish — don't double-fire here.
	      if (!programmaticZoom && focusedHNode) {
		  const el = selectionNode(nodes.filter(d => d === focusedHNode));
		  onHighlight?.(focusedHNode.data, el);
	      }
	      programmaticZoom = false;
	  });

    svg.call(z);
    svg.on('dblclick.zoom', null);

    const nodeConfig = {
	height: 100,
	width: 200,
	marginX: 50,
	marginY: 100,
	paddingX: 15,
	paddingY: 30,
	edgeMargin: 15,
	rx: 10,
	ry: 10,
	fill: colors.background,
    };

    const treeLayout = tree<AstNode>()
	.nodeSize([nodeConfig.width + nodeConfig.marginX, nodeConfig.height + nodeConfig.marginY]);

    const root = hierarchy(data);
    treeLayout(root);

    function getX(x: number): number {
	return x + config.width - nodeConfig.width / 2;
    }

    container.call(drag());

    type HNode = HierarchyNode<AstNode>;

    let focusedHNode: HNode | null = null;
    let highlightedEl: Element | null = null;
    let programmaticZoom = false;
    let navigating = false;

    function setHighlight(el: Element | null) {
	if (highlightedEl) select(highlightedEl).select('rect').attr('stroke', 'white');
	highlightedEl = el;
	if (highlightedEl) select(highlightedEl).select('rect').attr('stroke', colors.highlight);
    }

    function focusNode(d: HNode, animate: boolean, onComplete?: () => void) {
	const nx = getX(d.x!) + nodeConfig.width / 2;
	const ny = d.y! + nodeConfig.height / 2;
	const k = 0.5;
	const targetX = (config.width + 20) / 2;
	const targetY = (config.height + 20) * 0.25;
	const transform = zoomIdentity.scale(k).translate(targetX / k - nx, targetY / k - ny);
	const useAnimation = animate && !prefersReducedMotion;
	if (useAnimation) {
	    const currentT = getZoomTransform(svg.node()!);
	    if (Math.abs(currentT.k - k) < 0.001) {
		const ix = interpolateNumber(currentT.x, transform.x);
		const iy = interpolateNumber(currentT.y, transform.y);
		svg.transition().duration(400).tween('zoom', () => (t) => {
		    const newT = new ZoomTransform(k, ix(t), iy(t));
		    svg.property('__zoom', newT);
		    g.attr('transform', newT.toString());
		}).on('end', () => onComplete?.());
	    } else {
		programmaticZoom = true;
		svg.transition().duration(400).call(z.transform, transform).on('end', () => onComplete?.());
	    }
	} else {
	    svg.call(z.transform, transform);
	    onComplete?.();
	}
    }

    function moveFocus(hnode: HNode, animate: boolean) {
	focusedHNode = hnode;
	const el = selectionNode(nodes.filter(d => d === hnode));
	if (animate && !prefersReducedMotion) {
	    // Enter unfocused state while travelling: clear visual + cross-panel.
	    navigating = true;
	    setHighlight(null);
	    onHighlight?.(null, null);
	    focusNode(hnode, true, () => {
		navigating = false;
		setHighlight(el);
		onHighlight?.(hnode.data, el);
	    });
	} else {
	    setHighlight(el);
	    focusNode(hnode, false, () => onHighlight?.(hnode.data, el));
	}
    }

    const nodes = svg
	  .select('g.nodes')
	  .selectAll('g')
	  .data(root.descendants())
	  .join('g')
	  .attr('transform', (d) => `translate(${getX(d.x!)}, ${d.y!})`)
	  .attr('data-start', (d) => d.data.start ?? null);

    const links = svg.select('g.links')
	.selectAll('line.link')
	.data(root.links())
	.join('line')
	.classed('link', true);

    const linkLabels = svg.select('g.links')
	.selectAll('text')
	.data(root.links())
	.join('text')
	.attr('fill', colors.identifier ?? null)
	.attr('font-size', 12);

    function updateLayoutPositions(refocus = false) {
	config = measureContainer(containerEl);
	svg.attr('width', config.width + 20).attr('height', config.height + 20);
	treeLayout(root);

	nodes.attr('transform', (d) => `translate(${getX(d.x!)}, ${d.y!})`);

	links
	    .attr('x1', (d) => getX(d.source.x!) + nodeConfig.width / 2)
	    .attr('y1', (d) => d.source.y! + nodeConfig.height + nodeConfig.edgeMargin)
	    .attr('x2', (d) => getX(d.target.x!) + nodeConfig.width / 2)
	    .attr('y2', (d) => d.target.y! - nodeConfig.edgeMargin);

	linkLabels
	    .text((d) => d.target.data.childType || '')
	    .attr('x', (d) => getX(d.source.x!) / 2 + getX(d.target.x!) / 2 + nodeConfig.width / 2)
	    .attr('y', (d) => (d.source.y! + d.target.y!) / 2 + nodeConfig.height / 2);

	if (refocus && focusedHNode) {
	    moveFocus(focusedHNode, false);
	}
    }

    svg.attr('tabindex', '0');
    function clearFocus() {
	if (navigating) {
	    navigating = false;
	    svg.interrupt(); // cancel in-flight pan
	}
	focusedHNode = null;
	setHighlight(null);
	onHighlight?.(null, null);
    }
    svg.on('click', () => clearFocus());

    svg.on('keydown', (event: KeyboardEvent) => {
	if (!focusedHNode) return;
	const dirMap: Record<string, NavDirection | undefined> = {
	    ArrowLeft: 'left',
	    ArrowRight: 'right',
	    ArrowUp: 'up',
	    ArrowDown: 'down',
	};
	const dir = dirMap[event.key];
	if (!dir) return;
	event.preventDefault(); // always consume arrow keys when a node is focused
	const next = adjacentNode(root, focusedHNode, dir);
	if (!next) return;
	moveFocus(next, !prefersReducedMotion);
    });

    nodes.on('click', (event, d) => {
	event.stopPropagation();
	if (focusedHNode === d) return;
	moveFocus(d, !prefersReducedMotion);
	svg.node()!.focus({ preventScroll: true });
    });

    moveFocus(root as HNode, false);

    nodes.append('rect')
	.attr('width', nodeConfig.width)
	.attr('height', nodeConfig.height)
	.attr('rx', nodeConfig.rx)
	.attr('ry', nodeConfig.ry)
	.attr('fill', nodeConfig.fill)
	.attr('stroke', 'white');

    nodes.append('text')
	.text(d => d.data.type)
	.attr('fill', colors.keyword ?? null)
	.attr('font-size', 16)
	.attr('x', nodeConfig.paddingX)
	.attr('y', nodeConfig.paddingY);

    nodes.filter(d => typeof d.data.attrs?.name === 'string').append('text')
	.text(d => d.data.attrs.name as string)
	.attr('fill', colors.identifier ?? null)
	.attr('font-size', 12)
	.attr('x', nodeConfig.paddingX)
	.attr('y', nodeConfig.paddingY + 12 * 2);

    nodes.filter(d => Array.isArray(d.data.attrs?.params)).append('text')
	.text(d => `(${(d.data.attrs.params as string[]).join(', ')})`)
	.attr('fill', colors.identifier ?? null)
	.attr('font-size', 12)
	.attr('x', nodeConfig.paddingX)
	.attr('y', nodeConfig.paddingY + 12 * 4);

    updateLayoutPositions(false);

    let debounceId: ReturnType<typeof setTimeout> | undefined;
    const resizeObserver = new ResizeObserver(() => {
	clearTimeout(debounceId);
	debounceId = setTimeout(() => updateLayoutPositions(true), 100);
    });
    resizeObserver.observe(containerEl);

    function focusByStart(start: number) {
	const node = findNodeForOffset(data, start);
	if (!node) return;
	const hnode = root.descendants().find(d => d.data === node);
	if (hnode) moveFocus(hnode, !prefersReducedMotion);
    }

    const handle = focusByStart as AstHandle;
    handle.getSelectedNode = () => focusedHNode?.data ?? null;
    handle.getSelectedNodeRect = () => {
	if (!focusedHNode) return null;
	const el = selectionNode(nodes.filter(d => d === focusedHNode));
	const rect = el?.querySelector('rect');
	return rect ? rect.getBoundingClientRect() : null;
    };
    handle.findByStart = (start: number) => findNodeForOffset(data, start);
    handle.clearFocus = () => clearFocus();
    handle.canMove = (dir) => {
	if (!focusedHNode) return false;
	return adjacentNode(root, focusedHNode, dir) !== null;
    };
    handle.isNavigating = () => navigating;
    handle.moveDirection = (dir) => {
	if (!focusedHNode) return;
	const next = adjacentNode(root, focusedHNode, dir);
	if (next) {
	    moveFocus(next, !prefersReducedMotion);
	    svg.node()!.focus({ preventScroll: true });
	}
    };
    handle.destroy = () => {
	resizeObserver.disconnect();
	clearTimeout(debounceId);
	container.selectAll('svg').remove();
    };
    return handle;
}

const DECLARATION_HEADER_TYPES = new Set(['Function', 'Var', 'Class', 'Method']);

function nodeOwnsAttrOffset(node: AstNode, offset: number): boolean {
    if (!node.attrStarts) return false;
    for (const value of Object.values(node.attrStarts)) {
        if (typeof value === 'number' && value === offset) return true;
        if (Array.isArray(value) && value.includes(offset)) return true;
    }
    return false;
}

function declarationHeaderEnd(node: AstNode): number {
    let bound = Infinity;
    for (const child of node.children) {
        if (child.start !== undefined) bound = Math.min(bound, child.start);
    }
    return bound;
}

function isInDeclarationHeader(node: AstNode, offset: number): boolean {
    if (!DECLARATION_HEADER_TYPES.has(node.type) || node.start === undefined) return false;
    if (offset < node.start) return false;
    return offset < declarationHeaderEnd(node);
}

export function findNodeForOffset(root: AstNode, offset: number): AstNode | null {
    type BestMatch = { node: AstNode; depth: number };
    const best: {
        exact: BestMatch | null;
        attr: BestMatch | null;
        header: BestMatch | null;
    } = { exact: null, attr: null, header: null };

    function walk(node: AstNode, depth: number) {
        if (node.start === offset) {
            if (!best.exact || depth >= best.exact.depth) best.exact = { node, depth };
        } else if (nodeOwnsAttrOffset(node, offset)) {
            if (!best.attr || depth >= best.attr.depth) best.attr = { node, depth };
        } else if (isInDeclarationHeader(node, offset)) {
            if (!best.header || depth >= best.header.depth) best.header = { node, depth };
        }
        for (const child of node.children) walk(child, depth + 1);
    }

    walk(root, 0);
    return best.exact?.node ?? best.attr?.node ?? best.header?.node ?? null;
}

export function collectSubtreeStarts(node: AstNode): number[] {
    const starts: number[] = [];
    function walk(n: AstNode) {
        if (n.start !== undefined) starts.push(n.start);
        if (n.attrStarts) {
            for (const value of Object.values(n.attrStarts)) {
                if (typeof value === 'number') starts.push(value);
                else starts.push(...value);
            }
        }
        for (const child of n.children) walk(child);
    }
    walk(node);
    return starts;
}
