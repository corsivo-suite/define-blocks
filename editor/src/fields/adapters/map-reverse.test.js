import { createReverseCoordinator, shouldReverseCanvasLocation } from './map-reverse';

describe( 'map reverse adapter', () => {
	it( 'limits canvas reverse geocoding to Mapbox', () => {
		const geocoder = { reverse: jest.fn() };

		expect( shouldReverseCanvasLocation( 'mapbox', geocoder ) ).toBe( true );
		expect( shouldReverseCanvasLocation( 'google', geocoder ) ).toBe( false );
		expect( shouldReverseCanvasLocation( 'osm', geocoder ) ).toBe( false );
		expect( shouldReverseCanvasLocation( 'mapbox', {} ) ).toBe( false );
	} );

	it( 'aborts and ignores a stale reverse result', async () => {
		const coordinator = createReverseCoordinator();
		const requests = [];
		const results = [];
		const request = ( signal ) => new Promise( ( resolve ) => {
			requests.push( { resolve, signal } );
		} );

		const first = coordinator.run( request, ( result ) => results.push( result ) );
		const second = coordinator.run( request, ( result ) => results.push( result ) );

		expect( requests[ 0 ].signal.aborted ).toBe( true );
		requests[ 0 ].resolve( 'stale' );
		requests[ 1 ].resolve( 'current' );
		await Promise.all( [ first, second ] );

		expect( results ).toEqual( [ 'current' ] );
	} );

	it( 'ignores a reverse result cancelled by another field interaction', async () => {
		const coordinator = createReverseCoordinator();
		const results = [];
		let pendingRequest;
		const request = ( signal ) => new Promise( ( resolve ) => {
			pendingRequest = { resolve, signal };
		} );
		const reverse = coordinator.run( request, ( result ) => results.push( result ) );

		coordinator.cancel();
		expect( pendingRequest.signal.aborted ).toBe( true );
		pendingRequest.resolve( 'cancelled' );
		await reverse;

		expect( results ).toEqual( [] );
	} );
} );
