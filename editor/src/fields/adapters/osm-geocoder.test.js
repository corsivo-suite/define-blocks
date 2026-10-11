jest.mock( '@corsivo-suite/wp-admin-maps', () => ( {
	hasCoordinates: ( location ) => Number.isFinite( location.latitude ) && Number.isFinite( location.longitude ),
	normalizeLocation: ( value ) => ( {
		latitude: Number( value?.latitude ),
		longitude: Number( value?.longitude ),
		address: value?.address || '',
	} ),
} ) );

import { createOsmGeocoder } from './osm-geocoder';

describe( 'createOsmGeocoder', () => {
	it( 'normalizes search and reverse responses', async () => {
		const fetch = jest.fn()
			.mockResolvedValueOnce( {
				ok: true,
				json: async () => [ {
					place_id: 7,
					lat: '41.9',
					lon: '12.5',
					display_name: 'Roma',
				} ],
			} )
			.mockResolvedValueOnce( {
				ok: true,
				json: async () => ( {
					place_id: 8,
					lat: '45.46',
					lon: '9.19',
					display_name: 'Milano',
				} ),
			} );
		const geocoder = createOsmGeocoder( { fetch } );

		expect( await geocoder.search( 'Roma' ) ).toEqual( [ {
			value: '7',
			label: 'Roma',
			location: { latitude: 41.9, longitude: 12.5, address: 'Roma' },
			meta: { osmType: null },
		} ] );
		expect( await geocoder.reverse( { latitude: 45.46, longitude: 9.19 } ) ).toEqual( {
			value: '8',
			label: 'Milano',
			location: { latitude: 45.46, longitude: 9.19, address: 'Milano' },
			meta: { osmType: null },
		} );
	} );

	it( 'shares the public request interval and cache between field instances', async () => {
		jest.useFakeTimers( { now: Date.now() + 100000 } );
		try {
			const starts = [];
			const fetch = jest.fn( async () => {
				starts.push( Date.now() );
				return { ok: true, json: async () => [] };
			} );
			const first = createOsmGeocoder( { fetch } );
			const second = createOsmGeocoder( { fetch } );
			const search = first.search( 'Interval test' );
			const reverse = second.reverse( { latitude: 12.34, longitude: 56.78 } );
			await jest.advanceTimersByTimeAsync( 2200 );
			await Promise.all( [ search, reverse ] );
			expect( starts ).toHaveLength( 2 );
			expect( starts[ 1 ] - starts[ 0 ] ).toBeGreaterThanOrEqual( 1100 );
			await second.search( 'Interval test' );
			expect( fetch ).toHaveBeenCalledTimes( 2 );
			expect( first.requiresSubmit ).toBe( true );
		} finally {
			jest.useRealTimers();
		}
	} );

	it( 'routes dedicated endpoints without enabling public search restrictions', async () => {
		const fetch = jest.fn().mockResolvedValue( { ok: true, json: async () => [] } );
		const geocoder = createOsmGeocoder( {
			fetch,
			searchEndpoint: 'https://geo.example.test/search',
			reverseEndpoint: 'https://geo.example.test/reverse',
		} );
		expect( geocoder.requiresSubmit ).toBe( false );
		await geocoder.search( 'Test' );
		await geocoder.reverse( { latitude: 1, longitude: 2 } );
		expect( fetch.mock.calls.map( ( [ url ] ) => url.origin + url.pathname ) ).toEqual( [ 'https://geo.example.test/search', 'https://geo.example.test/reverse' ] );
	} );
} );
