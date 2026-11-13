// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import { LoxVisualizer } from '@/lox-visualizer/lox-visualizer';
import { defaultSample } from '@/lox-visualizer/samples';

// Single entry for the visualizers page. Each visualizer mounts into a
// container the post supplies; the initial editor document comes from the
// samples store, not from the page. The Python visualizer mounts the same way
// (PythonVisualizer.mount) and is deliberately not imported yet — it is still
// work in progress, and an unreferenced module stays out of the bundle.
const LOX_CONTAINER_ID = 'viz-lox-container';

const container = document.getElementById(LOX_CONTAINER_ID);

if (!container) {
    console.warn(`lox-visualizer: no #${LOX_CONTAINER_ID} on the page`);
} else {
    defaultSample.load()
        .then((source) => LoxVisualizer.mount(container, source).setUp())
        .catch((error) => console.error('lox-visualizer: failed to start', error));
}
