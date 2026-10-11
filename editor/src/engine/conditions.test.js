import { evaluateCondition } from './conditions';

describe( 'evaluateCondition', () => {
	it.each( [
		[ 'amount >= 0', {}, false ],
		[ 'amount >= 0', { amount: null }, true ],
		[ 'amount >= 0', { amount: '' }, true ],
		[ 'amount >= 0', { amount: 'abc' }, false ],
		[ 'amount >= 0', { amount: 0 }, true ],
		[ 'amount >= 0', { amount: -1 }, false ],
		[ 'amount == null', {}, false ],
		[ 'amount == null', { amount: null }, true ],
		[ '!!amount', {}, false ],
		[ '!!amount', { amount: null }, false ],
		[ '!!amount', { amount: '' }, false ],
		[ '!!amount', { amount: '0' }, true ],
		[ 'amount < "2"', { amount: '10' }, true ],
		[ 'amount < 2', { amount: '10' }, false ],
	] )( 'evaluates %s with %p as %p', ( condition, values, expected ) => {
		expect( evaluateCondition( condition, values ) ).toBe( expected );
	} );

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
