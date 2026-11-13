// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

export class Component {
  children: Component[];

  // autoSetUp defaults to true to preserve the legacy behavior where
  // constructing a Component immediately runs setUp(). Subclasses that assign
  // fields in their own constructor (and therefore can't have setUp() run
  // during super()) pass autoSetUp = false and drive the lifecycle explicitly.
  constructor(children: Component[] = [], autoSetUp = true) {
    this.children = children;

    if (autoSetUp) {
      this.setUp();
    }
  }

  render() {}
  setUp() {
    for (let child of this.children) {
      child.setUp();
    }
  }
  tearDown() {
    for (let child of this.children) {
      child.tearDown();
    }
  }
}
