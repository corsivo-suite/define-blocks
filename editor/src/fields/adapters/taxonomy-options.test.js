import {
	buildTaxonomyRestPath,
	normalizeTermOption,
	replacePendingTermOption,
} from './taxonomy-options';

describe( 'taxonomy adapter contracts', () => {
	it( 'normalizes REST paths and term options', () => {
		expect( buildTaxonomyRestPath( '/wp/v2/', '/categories/' ) ).toBe( '/wp/v2/categories' );
		expect( normalizeTermOption( { id: 12, name: 'News' } ) ).toEqual( {
			value: '12',
			label: 'News',
		} );
	} );

	it( 'replaces a pending created term without duplicating an existing selection', () => {
		expect( replacePendingTermOption( [
			{ value: '12', label: 'Existing' },
			{ value: 'News', label: 'News', isCreated: true },
		], 'News', { id: 12, name: 'News' } ) ).toEqual( [
			{ value: '12', label: 'Existing' },
		] );
	} );
} );
