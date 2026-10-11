import { hasCoordinates, normalizeLocation } from '@corsivo-suite/wp-admin-maps';

let publicQueue = Promise.resolve();
let lastPublicRequest = 0;
const publicCache = new Map();

function isPublicEndpoint( endpoint ) {
	return new URL( endpoint ).hostname.toLowerCase() === 'nominatim.openstreetmap.org';
}

function waitForPublicRequest( signal ) {
	const delay = Math.max( 0, 1100 - ( Date.now() - lastPublicRequest ) );
	return new Promise( ( resolve, reject ) => {
		const abort = () => {
			clearTimeout( timer );
			reject( new DOMException( 'Request aborted', 'AbortError' ) );
		};
		const timer = setTimeout( () => {
			signal?.removeEventListener( 'abort', abort );
			resolve();
		}, delay );
		if ( signal?.aborted ) {
			abort();
		} else {
			signal?.addEventListener( 'abort', abort, { once: true } );
		}
	} );
}

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
	const fetchResponse = async ( url, signal ) => {
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
	const request = ( url, signal ) => {
		if ( ! isPublicEndpoint( url ) ) {
			return fetchResponse( url, signal );
		}
		const cacheKey = `${ url }|${ language || '' }`;
		const pending = publicQueue.then( async () => {
			if ( signal?.aborted ) {
				throw new DOMException( 'Request aborted', 'AbortError' );
			}
			if ( publicCache.has( cacheKey ) ) {
				return publicCache.get( cacheKey );
			}
			await waitForPublicRequest( signal );
			lastPublicRequest = Date.now();
			const response = await fetchResponse( url, signal );
			if ( publicCache.size >= 100 ) {
				publicCache.delete( publicCache.keys().next().value );
			}
			publicCache.set( cacheKey, response );
			return response;
		} );
		publicQueue = pending.catch( () => {} );
		return pending;
	};

	return {
		requiresSubmit: isPublicEndpoint( searchEndpoint ),
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
