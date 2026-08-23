import { hasCoordinates, normalizeLocation } from '@corsivo-suite/wp-admin-maps';

const normalizeSearchResult = ( result ) => {
	const location = normalizeLocation( {
		latitude: result?.lat,
		longitude: result?.lon,
		address: result?.display_name,
	} );

	if ( ! hasCoordinates( location ) ) {
		return null;
	}

	return {
		value: String( result.place_id || location.address ),
		label: location.address,
		location,
		meta: { osmType: result.type || null },
	};
};

export function createOsmGeocoder( {
	fetch: fetchImplementation = window.fetch.bind( window ),
	searchEndpoint = 'https://nominatim.openstreetmap.org/search',
	reverseEndpoint = 'https://nominatim.openstreetmap.org/reverse',
	language,
} = {} ) {
	const request = async ( url, signal ) => {
		const response = await fetchImplementation( url, {
			headers: {
				Accept: 'application/json',
				...( language ? { 'Accept-Language': language } : {} ),
			},
			signal,
		} );

		if ( ! response.ok ) {
			throw new Error( `OpenStreetMap geocoding failed with status ${ response.status }.` );
		}

		return response.json();
	};

	return {
		async search( query, { signal } = {} ) {
			if ( ! String( query || '' ).trim() ) {
				return [];
			}

			const url = new URL( searchEndpoint );
			url.searchParams.set( 'format', 'jsonv2' );
			url.searchParams.set( 'limit', '5' );
			url.searchParams.set( 'q', String( query ).trim() );
			const results = await request( url, signal );

			return ( Array.isArray( results ) ? results : [] )
				.map( normalizeSearchResult )
				.filter( Boolean );
		},
		async reverse( value, { signal } = {} ) {
			const location = normalizeLocation( value );
			if ( ! hasCoordinates( location ) ) {
				return null;
			}

			const url = new URL( reverseEndpoint );
			url.searchParams.set( 'format', 'jsonv2' );
			url.searchParams.set( 'lat', String( location.latitude ) );
			url.searchParams.set( 'lon', String( location.longitude ) );
			const result = await request( url, signal );

			return normalizeSearchResult( result );
		},
	};
}
