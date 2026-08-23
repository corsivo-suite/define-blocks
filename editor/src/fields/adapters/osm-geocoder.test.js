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
} );
