import { evaluateCondition } from './conditions';

describe( 'evaluateCondition', () => {
	it( 'evaluates nested paths and collection operators', () => {
		const values = {
			layout: 'grid',
			settings: { columns: 4 },
			tags: [ 'featured', 'dark' ],
		};

		expect(
			evaluateCondition(
				'layout == "grid" && settings.columns >= 3 && tags contains "featured"',
				values
			)
		).toBe( true );
	} );

	it( 'supports relation objects', () => {
		expect(
			evaluateCondition(
				{ relation: 'XOR', first: true, second: true },
				{ first: true, second: false }
			)
		).toBe( true );
	} );

	it( 'uses JavaScript truthiness and array emptiness', () => {
		expect( evaluateCondition( '!!items', { items: [] } ) ).toBe( true );
		expect( evaluateCondition( 'items !empty', { items: [ '' ] } ) ).toBe( true );
		expect( evaluateCondition( 'items empty', { items: [] } ) ).toBe( true );
	} );
} );
