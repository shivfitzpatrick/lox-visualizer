// @vitest-environment jsdom

import { assert } from 'chai';
import { createStore } from '@/lib/store';
import { ConnectorLayer } from '@/compiler-viz/connector-layer';
import type { VizSelection } from '@/compiler-viz/types';
import { ConsolePanel } from '@/compiler-viz/panels/console-panel';
import { EditorSlot } from '@/compiler-viz/slots/editor-slot';
import type { ConsoleMessage } from '@/compiler-viz/types';

describe('EditorSlot', () => {
    it('renders CodeMirror and invokes onRun with editor text', () => {
        const container = document.createElement('div');
        container.className = 'lox-panel lox-panel--editor';
        let runText: string | null = null;

        const slot = new EditorSlot(container, 'print 1;', (text) => {
            runText = text;
        });
        slot.setUp();

        assert.isTrue(container.querySelector('.lox-editor-container') != null);
        assert.isTrue(container.querySelector('.lox-editor-box') != null);
        assert.isTrue(container.querySelector('.cm-editor') != null);
        assert.equal(slot.getText(), 'print 1;');

        const button = container.querySelector('.lox-run-button') as HTMLButtonElement;
        button.click();
        assert.equal(runText, 'print 1;');

        slot.tearDown();
        assert.equal(container.childElementCount, 0);
    });

    it('round-trips setText/getText', () => {
        const container = document.createElement('div');
        container.className = 'lox-panel lox-panel--editor';
        const slot = new EditorSlot(container, 'print 1;', () => {});
        slot.setUp();

        slot.setText('var x = 1;');
        assert.equal(slot.getText(), 'var x = 1;');
        slot.tearDown();
    });
});

describe('ConsolePanel', () => {
    it('renders console messages from the console store', () => {
        const root = document.createElement('div');
        const container = document.createElement('div');
        container.className = 'lox-panel lox-panel--console';
        root.appendChild(container);
        document.body.appendChild(root);

        const dataStore = createStore({ data: null });
        const consoleStore = createStore<{ messages: ConsoleMessage[] }>({ messages: [] });
        const selectionStore = createStore<VizSelection>({
            selectedStart: null,
            selectedAstNode: null,
        });
        const connectors = new ConnectorLayer(root);

        const panel = new ConsolePanel(
            container,
            dataStore,
            consoleStore,
            selectionStore,
            connectors,
        );
        panel.setUp();

        consoleStore.set({
            messages: [
                { type: 'print', text: 'hello' },
                { type: 'error', text: 'oops' },
            ],
        });

        const lines = container.querySelectorAll('div');
        assert.equal(lines.length, 2);
        assert.equal(lines[0]?.textContent, 'hello');
        assert.equal(lines[0]?.className, 'console-print');
        assert.equal(lines[1]?.textContent, 'oops');
        assert.equal(lines[1]?.className, 'console-error');

        panel.tearDown();
        root.remove();
    });
});
