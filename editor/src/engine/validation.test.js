import { evaluateCondition } from './conditions';
import { validateAll, validateField } from './validation';

function createSchema( fields ) {
	return {
		content: { fields },
		inspector: [],
		'inspector-advanced': { fields: {} },
		toolbar: [],
	};
}

describe( 'validateField', () => {
	it( 'validates repeater cardinality including max zero', () => {
		expect( validateField( [], { type: 'repeater', min: 1 } ) ).toBe(
			'Minimum 1 items'
		);
		expect( validateField( [ {} ], { type: 'repeater', max: 0 } ) ).toBe(
			'Maximum 0 items'
		);
	} );

	it( 'counts Unicode code points consistently', () => {
		expect(
			validateField( '🎸', { minLength: 1, maxLength: 1 } )
		).toBeNull();
	} );

	it( 'rejects invalid numeric values without treating an optional empty input as zero', () => {
		const field = { type: 'text', originalType: 'number', min: 2 };
		expect( validateField( '', field ) ).toBeNull();
		expect( validateField( null, field ) ).toBeNull();
		expect( validateField( '12px', field ) ).toBe( 'Enter a valid number' );
		expect( validateField( Infinity, field ) ).toBe(
			'Enter a valid number'
		);
		expect( validateField( '12', field ) ).toBeNull();
		expect( validateField( 1, field ) ).toBe( 'Minimum value is 2' );
	} );

	it( 'validates required and minimum text length after tag and whitespace normalization', () => {
		expect(
			validateField( '<b></b>', { type: 'text', required: true } )
		).toBe( 'This field is required' );
		expect(
			validateField( '<script>ignored()</script>', {
				type: 'text',
				required: true,
			} )
		).toBe( 'This field is required' );
		expect(
			validateField( '   <b>Hi</b>   ', { type: 'text', minLength: 3 } )
		).toBe( 'Minimum 3 characters' );
		expect(
			validateField( ' \n\t ', { type: 'text', required: true } )
		).toBe( 'This field is required' );
		expect(
			validateField( '&amp;', {
				type: 'text',
				minLength: 5,
				maxLength: 5,
			} )
		).toBeNull();
		expect(
			validateField( 'A\nB', {
				type: 'textarea',
				minLength: 3,
				maxLength: 3,
			} )
		).toBeNull();
		expect(
			validateField( '<b></b>', { type: 'richtext', required: true } )
		).toBeNull();
	} );

	it( 'rejects malformed scalar and repeater shapes before generic array validation', () => {
		for ( const value of [ [ 'hello' ], {}, false, 12 ] ) {
			expect( validateField( value, { type: 'text' } ) ).toBe(
				'Invalid field value'
			);
		}
		expect( validateField( 12, { type: 'select' } ) ).toBeNull();
		for ( const value of [ 'invalid', {}, [ 'invalid row' ] ] ) {
			expect(
				validateAll(
					{ items: value },
					createSchema( { items: { type: 'repeater', fields: {} } } ),
					evaluateCondition
				)
			).toEqual( { items: 'Invalid field value' } );
		}
	} );

	it( 'treats an explicit null repeater as zero items without rejecting an optional value', () => {
		expect( validateField( null, { type: 'repeater' } ) ).toBeNull();
		expect(
			validateField( null, { type: 'repeater', required: true } )
		).toBe( 'This field is required' );
		expect( validateField( null, { type: 'repeater', min: 1 } ) ).toBe(
			'Minimum 1 items'
		);
		expect(
			validateAll(
				{ items: null },
				createSchema( { items: { type: 'repeater', fields: {} } } ),
				evaluateCondition
			)
		).toEqual( {} );
		expect( validateField( '3foo', { type: 'text', min: 4 } ) ).toBeNull();
	} );

	it( 'fails open for invalid patterns and keeps global patterns stable', () => {
		expect( validateField( 'value', { pattern: '[' } ) ).toBeNull();
		expect( validateField( 'aa', { pattern: '/a/g' } ) ).toBeNull();
		expect( validateField( 'aa', { pattern: '/a/g' } ) ).toBeNull();
	} );
} );

describe( 'validateAll', () => {
	it( 'returns nested repeater paths for fields, groups and tabs', () => {
		const schema = createSchema( {
			items: {
				type: 'repeater',
				min: 1,
				fields: {
					title: { type: 'text', required: true },
					meta: {
						type: 'group',
						fields: {
							slug: { type: 'text', required: true },
						},
					},
					settings: {
						type: 'tabpanels',
						tabs: [
							{
								fields: {
									label: { type: 'text', required: true },
								},
							},
						],
					},
				},
			},
		} );

		expect(
			validateAll(
				{ items: [ { title: '', slug: '', label: '' } ] },
				schema,
				evaluateCondition
			)
		).toEqual( {
			'items.0.title': 'This field is required',
			'items.0.slug': 'This field is required',
			'items.0.label': 'This field is required',
		} );
	} );

	it( 'revalidates repeater conditions against local and root values', () => {
		const schema = createSchema( {
			enabled: { type: 'checkbox' },
			items: {
				type: 'repeater',
				fields: {
					kind: { type: 'text' },
					localValue: {
						type: 'text',
						required: true,
						condition: 'kind == "visible"',
					},
					rootValue: {
						type: 'text',
						required: true,
						condition: 'root.enabled == true',
					},
				},
			},
		} );

		expect(
			validateAll(
				{ enabled: false, items: [ { kind: 'hidden' } ] },
				schema,
				evaluateCondition
			)
		).toEqual( {} );

		expect(
			validateAll(
				{ enabled: true, items: [ { kind: 'visible' } ] },
				schema,
				evaluateCondition
			)
		).toEqual( {
			'items.0.localValue': 'This field is required',
			'items.0.rootValue': 'This field is required',
		} );
	} );
} );
