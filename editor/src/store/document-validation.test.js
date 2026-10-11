import {
	documentHasValidationErrors,
	observeDocumentValidation,
} from './document-validation';

const definitions = {
	'demo/child': {
		_schema: {
			content: { fields: { title: { type: 'text', required: true } } },
		},
	},
	'demo/parent': {
		_schema: { content: { fields: { content: { type: 'innerblocks' } } } },
	},
};

const getDefinition = ( name ) => definitions[ name ];

describe( 'document validation', () => {
	it( 'keeps invalid children locked when their parent switches preview or collapses', () => {
		const child = {
			name: 'demo/child',
			attributes: { values: { title: '' } },
		};
		let blocks = [
			{ name: 'demo/parent', attributes: {}, innerBlocks: [ child ] },
		];
		let listener;
		const lockSaving = jest.fn();
		const unlockSaving = jest.fn();
		const unsubscribe = jest.fn();
		const stop = observeDocumentValidation( {
			getBlocks: () => blocks,
			getDefinition,
			lockSaving,
			unlockSaving,
			subscribe: ( callback ) => {
				listener = callback;
				return unsubscribe;
			},
		} );
		expect( lockSaving ).toHaveBeenCalledTimes( 1 );
		for ( const attributes of [
			{ isPreview: true },
			{ collapsed: true },
		] ) {
			blocks = [ { ...blocks[ 0 ], attributes } ];
			listener();
			expect( unlockSaving ).not.toHaveBeenCalled();
		}
		blocks = [
			{
				...blocks[ 0 ],
				innerBlocks: [
					{ ...child, attributes: { values: { title: 'Fixed' } } },
				],
			},
		];
		listener();
		expect( unlockSaving ).toHaveBeenCalledTimes( 1 );
		listener();
		expect( lockSaving ).toHaveBeenCalledTimes( 1 );
		stop();
		expect( unsubscribe ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'validates descendants of native blocks and unlocks when an invalid subtree is deleted', () => {
		let blocks = [
			{
				name: 'core/group',
				innerBlocks: [
					{ name: 'demo/child', attributes: { values: {} } },
				],
			},
		];
		expect( documentHasValidationErrors( blocks, getDefinition ) ).toBe(
			true
		);
		let listener;
		const unlockSaving = jest.fn();
		const stop = observeDocumentValidation( {
			getBlocks: () => blocks,
			getDefinition,
			lockSaving: jest.fn(),
			unlockSaving,
			subscribe: ( callback ) => {
				listener = callback;
				return () => {};
			},
		} );
		blocks = [];
		listener();
		expect( unlockSaving ).toHaveBeenCalledTimes( 1 );
		stop();
	} );
} );
