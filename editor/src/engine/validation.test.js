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
		expect( validateField( '🎸', { minLength: 1, maxLength: 1 } ) ).toBeNull();
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
