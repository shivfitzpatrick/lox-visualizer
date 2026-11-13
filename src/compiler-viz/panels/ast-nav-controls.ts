// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import type { AstHandle } from '@/compiler-viz/ast';

type NavDirection = 'left' | 'right' | 'up' | 'down';

const BUTTONS: Array<{ dir: NavDirection; label: string; gridArea: string }> = [
    { dir: 'up', label: 'Parent node', gridArea: 'up' },
    { dir: 'left', label: 'Previous sibling', gridArea: 'left' },
    { dir: 'right', label: 'Next sibling', gridArea: 'right' },
    { dir: 'down', label: 'First child', gridArea: 'down' },
];

export class AstNavControls {
    private root: HTMLElement;
    private handle: AstHandle | null = null;

    constructor(parent: HTMLElement) {
        this.root = document.createElement('div');
        this.root.className = 'ast-nav-controls';
        this.root.setAttribute('aria-label', 'AST tree navigation');
        this.root.hidden = true;

        for (const { dir, label, gridArea } of BUTTONS) {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = `ast-nav-controls__btn ast-nav-controls__btn--${gridArea}`;
            btn.setAttribute('aria-label', label);
            btn.textContent = navGlyph(dir);
            btn.addEventListener('mousedown', (event) => {
                // Prevent the button from stealing browser focus from the SVG
                // so keyboard arrows keep working after a button click.
                event.preventDefault();
            });
            btn.addEventListener('click', (event) => {
                event.stopPropagation();
                this.handle?.moveDirection(dir);
            });
            this.root.appendChild(btn);
        }

        parent.appendChild(this.root);
    }

    setHandle(handle: AstHandle | null) {
        this.handle = handle;
        this.sync();
    }

    sync() {
        if (!this.handle || this.handle.isNavigating()) {
            this.root.hidden = true;
            return;
        }

        const anyMove = BUTTONS.some(({ dir }) => this.handle!.canMove(dir));
        this.root.hidden = !anyMove && !this.handle.getSelectedNode();

        for (const btn of this.root.querySelectorAll<HTMLButtonElement>('button')) {
            const dir = btn.className.match(/--(up|left|right|down)/)?.[1] as NavDirection | undefined;
            if (!dir) continue;
            btn.disabled = !this.handle.canMove(dir);
        }
    }

    destroy() {
        this.root.remove();
        this.handle = null;
    }
}

function navGlyph(dir: NavDirection): string {
    switch (dir) {
        case 'up': return '↑';
        case 'down': return '↓';
        case 'left': return '←';
        case 'right': return '→';
    }
}
