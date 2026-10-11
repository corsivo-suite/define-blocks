import {
	buildEmpty,
	collectDefaults,
	hydrateSchemaValues,
	hydrateValues,
	isEmptyValue,
	normalizeNumericValue,
	parseFieldValue,
} from './values';

function createSchema( fields ) {
	return {
		content: { fields },
		inspector: [],
		'inspector-advanced': { fields: {} },
		toolbar: [],
	};
}

describe( 'field values', () => {
	it( 'collects root defaults without leaking repeater subfield defaults', () => {
		const schema = createSchema( {
			title: { type: 'text', default: 'Default title' },
			items: {
				type: 'repeater',
				default: [],
				fields: {
					label: { type: 'text', default: 'Nested label' },
				},
			},
		} );

		expect( collectDefaults( schema ) ).toEqual( {
			title: 'Default title',
			items: [],
		} );
	} );

	it( 'builds stable empty values for composite field types', () => {
		expect( buildEmpty( { type: 'link' } ) ).toEqual( {
			url: '',
			title: '',
			opensInNewTab: false,
		} );
		expect( buildEmpty( { type: 'range', min: 5 } ) ).toBe( 5 );
		expect( buildEmpty( { type: 'checkbox', default: true } ) ).toBe(
			true
		);
	} );

	it( 'normalizes checkbox and numeric values', () => {
		expect( parseFieldValue( 0, 'checkbox' ) ).toBe( false );
		expect( parseFieldValue( '12.5', 'range' ) ).toBe( 12.5 );
		expect( isEmptyValue( [] ) ).toBe( true );
		expect( isEmptyValue( [ '' ] ) ).toBe( false );
		expect( isEmptyValue( { url: '', opensInNewTab: false } ) ).toBe(
			true
		);
	} );

	it( 'hydrates old repeater rows through flat groups and tabs without replacing explicit empty values', () => {
		const schema = createSchema( {
			items: {
				type: 'repeater',
				fields: {
					title: { type: 'text', default: 'Title' },
					color: { type: 'color', default: '#ff0000' },
					group: {
						type: 'group',
						fields: {
							amount: {
								type: 'text',
								originalType: 'number',
								default: '3',
							},
						},
					},
					tabs: {
						type: 'tabpanels',
						tabs: [
							{
								fields: {
									link: {
										type: 'link',
										default: {
											url: '/default',
											title: 'Link',
										},
									},
								},
							},
						],
					},
				},
			},
		} );
		const values = {
			unknown: 'Keep',
			items: [ { title: '', color: null, custom: 'Keep too' } ],
		};
		const hydrated = hydrateSchemaValues( schema, values );
		expect( hydrated ).toEqual( {
			unknown: 'Keep',
			items: [
				{
					title: '',
					color: null,
					custom: 'Keep too',
					amount: 3,
					link: { url: '/default', title: 'Link' },
				},
			],
		} );
		expect( values.items[ 0 ].amount ).toBeUndefined();
		expect( hydrateSchemaValues( schema, hydrated ) ).toBe( hydrated );
	} );

	it( 'clones structured defaults for each newly created row', () => {
		const fields = {
			gallery: { type: 'gallery', default: [ { id: 7 } ] },
			link: { type: 'link', default: { url: '/default' } },
		};
		const first = hydrateValues( fields, {} );
		const second = hydrateValues( fields, {} );
		first.gallery[ 0 ].id = 9;
		first.link.url = '/changed';
		expect( second ).toEqual( {
			gallery: [ { id: 7 } ],
			link: { url: '/default' },
		} );
		expect( fields.gallery.default[ 0 ].id ).toBe( 7 );
	} );

	it( 'normalizes finite decimal numbers while preserving empty and invalid input', () => {
		expect( normalizeNumericValue( ' 1.25e2 ' ) ).toBe( 125 );
		for ( const value of [
			'',
			null,
			'abc',
			'0x10',
			'1e999',
			'12px',
			'   ',
		] ) {
			expect( normalizeNumericValue( value ) ).toBe( value );
		}
	} );

	it( 'normalizes known booleans and choices without erasing malformed repeater rows', () => {
		const fields = {
			enabled: { type: 'checkbox' },
			choice: { type: 'select' },
			items: {
				type: 'repeater',
				fields: { title: { type: 'text', default: 'Default' } },
			},
		};
		expect(
			hydrateValues( fields, {
				enabled: 'false',
				choice: 12,
				items: [ 'Broken', [] ],
			} )
		).toEqual( {
			enabled: false,
			choice: '12',
			items: [ 'Broken', { title: 'Default' } ],
		} );
	} );
} );
