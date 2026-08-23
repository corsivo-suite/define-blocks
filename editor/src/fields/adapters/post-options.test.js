jest.mock( '@wordpress/api-fetch', () => jest.fn(), { virtual: true } );
jest.mock( '@wordpress/url', () => ( { addQueryArgs: ( path ) => path } ), { virtual: true } );

import { normalizePostOption, toLegacyPosts } from './post-options';

describe( 'post option adapter', () => {
	it( 'maps API results and preserves the legacy saved post shape', () => {
		const option = normalizePostOption( {
			id: 12,
			title: 'Example',
			permalink: '/example',
			thumbnail: '/image.jpg',
		} );
		expect( option ).toMatchObject( {
			value: '12',
			label: 'Example',
			url: '/example',
		} );
		expect( toLegacyPosts( [ '12' ], [ option ] ) ).toEqual( [ {
			id: 12,
			title: 'Example',
			permalink: '/example',
			thumbnail: '/image.jpg',
		} ] );
	} );
} );
