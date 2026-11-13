// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

import 'd3';
import { assert } from 'chai';

declare global {
    interface Window {
	assert: typeof assert;
    }
}

window.assert = assert

function testSuite(suiteName: string) {
    return {
	testCases: [] as [string, () => void][],
	addCase(description: string, testCase: () => void) {
	    this.testCases.push([description, testCase]);
	},
	async runTests() {
	    if (suiteName) {
		console.log(`Test suite: ${suiteName}`);
	    } else {
		console.log(`Test suite`);
	    }

	    for (const [description, testCase] of this.testCases) {
		try {
		    testCase();
		    console.log(`test case '${description}' passed`);
		} catch (e) {
		    console.error(`test case '${description}' failed: '${(e as Error).message}'`);
		}
	    }
	},
    };
}

export { testSuite };
