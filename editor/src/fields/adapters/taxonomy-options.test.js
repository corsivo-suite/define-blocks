import {
	buildTaxonomyRestPath,
	buildTaxonomySearchPath,
	chunkTermValues,
	mergeTermOptions,
	normalizeTermOption,
	normalizeTermOptions,
	replacePendingTermOption,
} from './taxonomy-options';

describe( 'taxonomy adapter contracts', () => {
	it( 'normalizes REST paths and term options', () => {
		expect( buildTaxonomyRestPath( '/wp/v2/', '/categories/' ) ).toBe( '/wp/v2/categories' );
		expect( normalizeTermOption( { id: 12, name: 'News', path: 'Company › News' } ) ).toEqual( {
			value: '12',
			label: 'Company › News',
		} );
		expect( normalizeTermOptions( null ) ).toEqual( [] );
	} );

	it( 'builds bounded search and hydration requests', () => {
		const searchUrl = new URL( buildTaxonomySearchPath( 'category', {
			search: 'news',
			page: 2,
			perPage: 25,
		} ), 'https://example.com' );
		expect( Object.fromEntries( searchUrl.searchParams ) ).toEqual( {
			taxonomy: 'category',
			search: 'news',
			page: '2',
			per_page: '25',
		} );

		const hydrationUrl = new URL( buildTaxonomySearchPath( 'category', {
			search: 'ignored',
			include: [ '12', '13' ],
			perPage: 2,
		} ), 'https://example.com' );
		expect( hydrationUrl.searchParams.get( 'include' ) ).toBe( '12,13' );
		expect( hydrationUrl.searchParams.has( 'search' ) ).toBe( false );
	} );

	it( 'chunks large selections and keeps the first option for each value', () => {
		const values = Array.from( { length: 205 }, ( _, index ) => index + 1 );
		expect( chunkTermValues( values ).map( ( chunk ) => chunk.length ) ).toEqual( [ 100, 100, 5 ] );
		expect( mergeTermOptions(
			[ { value: '12', label: 'Current label' } ],
			[ { value: 12, label: 'Duplicate' }, { value: '13', label: 'Second' } ]
		) ).toEqual( [
			{ value: '12', label: 'Current label' },
			{ value: '13', label: 'Second' },
		] );
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
