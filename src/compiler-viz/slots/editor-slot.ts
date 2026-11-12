import { EditorView, basicSetup } from 'codemirror';
import { EditorState } from '@codemirror/state';

import { Component } from '@/lib/component';
import type { VisualizerSlot } from '@/compiler-viz/layout';
import { clearContainer, panelSelection, selectionElement } from '@/compiler-viz/d3-utils';

export class EditorSlot extends Component implements VisualizerSlot {
    readonly slotId = 'editor' as const;

    private editorView!: EditorView;

    constructor(
        private container: HTMLElement,
        private initialDoc: string,
        private onRun: (text: string) => void,
    ) {
        super([], false);
    }

    setUp() {
        this.editorView = new EditorView({
            state: EditorState.create({
                doc: this.initialDoc,
                extensions: [basicSetup],
            }),
        });

        const root = panelSelection(this.container);
        const editorContainer = root.append('div').classed('lox-editor-container', true);
        const editorBox = editorContainer.append('div').classed('lox-editor-box', true);
        const boxEl = selectionElement<HTMLElement>(editorBox);
        if (boxEl) boxEl.appendChild(this.editorView.dom);

        editorContainer.append('button')
            .classed('lox-run-button', true)
            .text('Build')
            .on('click', () => this.onRun(this.getText()));
    }

    tearDown() {
        this.editorView?.destroy();
        clearContainer(this.container);
    }

    getText(): string {
        return this.editorView.state.doc.toString();
    }

    setText(text: string): void {
        this.editorView.dispatch({
            changes: { from: 0, to: this.editorView.state.doc.length, insert: text },
        });
    }
}
