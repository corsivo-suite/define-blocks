import { createRoot } from '@wordpress/element';
import MapField from './MapField';

const { act } = jest.requireActual( 'react' );
const mockCanvas = jest.fn( () => null );
const mockCreateGeocoder = jest.fn();

jest.mock( '@wordpress/block-editor', () => ( {
	InspectorControls: ( { children } ) => children,
} ), { virtual: true } );
jest.mock( '@wordpress/components', () => ( {
	BaseControl: ( { children } ) => children,
	Notice: ( { children } ) => children,
	PanelBody: ( { children } ) => children,
} ), { virtual: true } );
jest.mock( '@corsivo-suite/wp-admin-maps', () => ( {
	MapCanvas: ( props ) => mockCanvas( props ),
} ) );
jest.mock( './FieldGeocoderControl', () => () => null );
jest.mock( './map-provider', () => ( {
	getMapProvider: ( type ) => type === 'mapbox-map' ? 'mapbox' : 'osm',
	providerNeedsKey: () => false,
	createFieldGeocoder: ( ...argumentsList ) => mockCreateGeocoder( ...argumentsList ),
	createFieldRenderer: () => ( {} ),
} ) );

describe( 'map field pending reverse lookup', () => {
	let root;
	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		root = createRoot( document.createElement( 'div' ) );
		mockCanvas.mockClear();
		mockCreateGeocoder.mockReset();
	} );
	afterEach( () => act( () => root.unmount() ) );

	it( 'delivers the resolved address through the current callback', async () => {
		let resolve;
		const geocoder = { reverse: jest.fn( () => new Promise( ( finish ) => { resolve = finish; } ) ) };
		mockCreateGeocoder.mockReturnValue( geocoder );
		const field = { type: 'mapbox-map' };
		const previousOnChange = jest.fn();
		const currentOnChange = jest.fn();
		const render = ( onChange, value = {} ) => root.render( <MapField id="location" type="mapbox-map" field={ field } value={ value } onChange={ onChange } /> );
		act( () => render( previousOnChange ) );
		let pendingLookup;
		act( () => { pendingLookup = mockCanvas.mock.lastCall[ 0 ].onLocationChange( { latitude: 41.9, longitude: 12.5 } ); } );
		act( () => render( currentOnChange, previousOnChange.mock.lastCall[ 0 ] ) );
		await act( async () => {
			resolve( { location: { latitude: 41.9, longitude: 12.5, address: 'Rome' } } );
			await pendingLookup;
		} );
		expect( previousOnChange ).toHaveBeenCalledTimes( 1 );
		expect( currentOnChange ).toHaveBeenCalledWith( expect.objectContaining( { address: 'Rome', latitude: 41.9, longitude: 12.5 } ) );
	} );

	it( 'discards reverse results after the provider changes', async () => {
		let resolve;
		const geocoder = { reverse: jest.fn( () => new Promise( ( finish ) => { resolve = finish; } ) ) };
		mockCreateGeocoder.mockImplementation( ( provider ) => provider === 'mapbox' ? geocoder : {} );
		const onChange = jest.fn();
		const field = {};
		act( () => root.render( <MapField id="location" type="mapbox-map" field={ field } value={ {} } onChange={ onChange } /> ) );
		let pendingLookup;
		act( () => { pendingLookup = mockCanvas.mock.lastCall[ 0 ].onLocationChange( { latitude: 41.9, longitude: 12.5 } ); } );
		act( () => root.render( <MapField id="location" type="osm-map" field={ field } value={ {} } onChange={ onChange } /> ) );
		await act( async () => {
			resolve( { location: { latitude: 41.9, longitude: 12.5, address: 'Outdated' } } );
			await pendingLookup;
		} );
		expect( geocoder.reverse.mock.calls[ 0 ][ 1 ].signal.aborted ).toBe( true );
		expect( onChange ).toHaveBeenCalledTimes( 1 );
	} );
} );
