// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import type { Instruction } from '@/compiler-viz/types';
import type { PanelSelection } from '@/compiler-viz/d3-utils';

export type OnInstructionClick = (event: Instruction | null, el: HTMLElement | null) => void;

function formatOperand(instr: Instruction): string {
    if (instr.jumpTarget != null) return `→ ${instr.jumpTarget}`;
    if (instr.constant != null) {
        const argCount = instr.argCount != null ? ` (${instr.argCount} args)` : '';
        return `'${instr.constant}'${argCount}`;
    }
    if (instr.arg != null) return String(instr.arg);
    return '';
}

export function drawBytecode(
    target: PanelSelection,
    chunks: Map<string, Instruction[]>,
    onClick?: OnInstructionClick,
): void {
    target.selectAll('details').remove();

    let isFirst = true;
    for (const [chunkName, instrs] of chunks) {
        const details = target.append('details');
        if (isFirst) details.attr('open', '');
        isFirst = false;

        details.append('summary').classed('bc-chunk-name', true).text(chunkName);

        const table = details.append('table').classed('bc-table', true);
        const thead = table.append('thead');
        const headerRow = thead.append('tr');
        headerRow.append('th').classed('bc-offset', true).text('Offset');
        headerRow.append('th').classed('bc-line', true).text('Line');
        headerRow.append('th').classed('bc-op', true).text('Op');
        headerRow.append('th').classed('bc-operand', true).text('Operand');
        const tbody = table.append('tbody');

        const rows = tbody.selectAll<HTMLTableRowElement, Instruction>('tr')
            .data(instrs)
            .join('tr')
            .attr('data-src-offset', d => d.srcOffset)
            .attr('data-offset', d => String(d.offset))
            .attr('data-chunk', d => d.chunk)
            .on('click', (event, d) => {
                event.stopPropagation();
                onClick?.(d, event.currentTarget as HTMLElement);
            });

        rows.append('td').classed('bc-offset', true)
            .text(d => String(d.offset).padStart(4, '0'));

        rows.append('td').classed('bc-line', true)
            .text(d => String(d.line));

        rows.append('td').classed('bc-op', true)
            .text(d => d.op);

        rows.append('td').classed('bc-operand', true)
            .text(d => formatOperand(d));
    }
}
