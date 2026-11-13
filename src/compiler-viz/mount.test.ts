// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

// @vitest-environment jsdom

import { assert } from 'chai';
import {
    DEFAULT_LAYOUT,
    kindsInLayout,
    panelLabel,
} from '@/compiler-viz/layout';
import {
    buildLayoutDOM,
    mountVisualizerInto,
} from '@/compiler-viz/mount';

function fixtureContainer(id = 'viz-lox-container'): HTMLElement {
    const container = document.createElement('div');
    container.id = id;
    document.body.appendChild(container);
    return container;
}

describe('buildLayoutDOM()', () => {
    it('builds DEFAULT_LAYOUT with five rows and seven pane shells', () => {
        const { root, containers } = buildLayoutDOM(DEFAULT_LAYOUT);

        assert.equal(root.className, 'lox-visualizer');
        assert.equal(root.querySelectorAll('.lox-visualizer-row').length, 5);
        assert.equal(root.querySelectorAll('.lox-pane').length, 7);
        assert.equal(root.querySelectorAll('.lox-panel-label').length, 7);
        assert.equal(root.querySelectorAll('.lox-panel').length, 7);
        assert.equal(containers.size, 7);

        // Picker bar mount sits between the pane switcher and the app grid.
        const bar = root.querySelector('.lox-sample-picker-bar');
        assert.isNotNull(bar);
        assert.isTrue(bar!.nextElementSibling?.classList.contains('lox-visualizer-app'));

        const lexer = containers.get('lexer')!;
        assert.isTrue(lexer.classList.contains('lox-panel--lexer'));
        assert.equal(lexer.id, 'lox-lexer');
        assert.isTrue(lexer.parentElement?.classList.contains('lox-pane'));
        assert.equal(lexer.previousElementSibling?.className, 'lox-panel-label');
        assert.equal(lexer.previousElementSibling?.textContent, 'Lexer');

        const bytecode = containers.get('bytecode')!;
        assert.isTrue(bytecode.classList.contains('lox-panel--bytecode'));
        assert.equal(bytecode.id, 'lox-compiler');

        for (const kind of kindsInLayout(DEFAULT_LAYOUT)) {
            const shell = containers.get(kind)!;
            const label = shell.previousElementSibling;
            assert.isTrue(label?.classList.contains('lox-panel-label'));
            assert.equal(label?.textContent, panelLabel(kind));
        }
    });

    it('builds a minimal lexer-only layout with label', () => {
        const { root, containers } = buildLayoutDOM([['lexer']]);

        assert.equal(root.querySelectorAll('.lox-visualizer-row').length, 1);
        assert.equal(root.querySelectorAll('.lox-pane').length, 1);
        assert.equal(containers.size, 1);
        assert.isTrue(containers.get('lexer')!.classList.contains('lox-panel--lexer'));
        assert.equal(
            containers.get('lexer')!.previousElementSibling?.textContent,
            'Lexer',
        );
    });

    it('rejects duplicate kinds via validateLayout', () => {
        assert.throws(() => buildLayoutDOM([['lexer'], ['lexer']]), /Duplicate panel kind/);
    });
});

describe('mountVisualizerInto()', () => {
    it('mounts the visualizer root inside the container', () => {
        const container = fixtureContainer();
        const result = mountVisualizerInto(container, DEFAULT_LAYOUT);

        assert.equal(result.root.className, 'lox-visualizer');
        assert.equal(result.root.parentElement, container);
        assert.equal(result.containers.get('editor')!.id, 'lox-editor');

        container.remove();
    });

    it('replaces existing content instead of stacking a second root', () => {
        const container = fixtureContainer();
        container.appendChild(document.createElement('p'));

        mountVisualizerInto(container, [['lexer']]);
        const second = mountVisualizerInto(container, [['lexer']]);

        assert.equal(container.children.length, 1);
        assert.equal(container.firstElementChild, second.root);
        assert.isNull(container.querySelector('p'));

        container.remove();
    });

    it('scopes each mount to its own container', () => {
        const lox = fixtureContainer('viz-lox-container');
        const python = fixtureContainer('viz-python-container');

        const loxResult = mountVisualizerInto(lox, [['lexer']]);
        const pythonResult = mountVisualizerInto(python, [['ast']]);

        assert.equal(loxResult.containers.get('lexer')!.closest('#viz-lox-container'), lox);
        assert.equal(pythonResult.containers.get('ast')!.closest('#viz-python-container'), python);

        lox.remove();
        python.remove();
    });
});
