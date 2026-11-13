// SPDX-FileCopyrightText: 2026 Siobhan Fitzpatrick
// SPDX-License-Identifier: GPL-3.0-or-later

export const sampleData = {
    type: 'Program',
    category: 'Program',
    children: [{
	type: 'Function',
	relation: '',
	attrs: {
	    name: 'loopPrinter',
	    params: ['addMe', 'minusMe'],
	},
	category: 'Statement',
	children: [
	    {
		type: 'Var',
		category: 'Statement',
		attrs: {
		    name: 'i',
		},
	    },
	    {
		type: 'While',
		category: 'Statement',
		children: [
		    {
			type: 'Print',
			category: 'Statement',
		    },
		    {
			type: 'Expression',
			category: 'Statement',
		    }
		]
	    }
	]
    }]
}
