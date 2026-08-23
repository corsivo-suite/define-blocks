import { buildEmpty, collectDefaults, isEmptyValue, parseFieldValue } from './values';

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
		expect( buildEmpty( { type: 'checkbox', default: true } ) ).toBe( true );
	} );

	it( 'normalizes checkbox and numeric values', () => {
		expect( parseFieldValue( 0, 'checkbox' ) ).toBe( false );
		expect( parseFieldValue( '12.5', 'range' ) ).toBe( 12.5 );
		expect( isEmptyValue( [] ) ).toBe( true );
		expect( isEmptyValue( [ '' ] ) ).toBe( false );
		expect( isEmptyValue( { url: '', opensInNewTab: false } ) ).toBe( true );
	} );
} );
