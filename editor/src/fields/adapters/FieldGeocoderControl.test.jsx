import { createRoot, useState } from '@wordpress/element';
import FieldGeocoderControl from './FieldGeocoderControl';

const { act } = jest.requireActual( 'react' );
const mockTextControl = jest.fn( () => null );
const mockGeocoderControl = jest.fn( () => null );

jest.mock( '@wordpress/components', () => ( {
	TextControl: ( props ) => mockTextControl( props ),
	Button: ( { children, onClick, disabled } ) => <button onClick={ onClick } disabled={ disabled }>{ children }</button>,
	Notice: ( { children } ) => <p>{ children }</p>,
} ), { virtual: true } );
jest.mock( '@corsivo-suite/wp-admin-maps', () => ( {
	GeocoderControl: ( props ) => mockGeocoderControl( props ),
} ) );

function Subject( props ) {
	const [ query, setQuery ] = useState( 'Rome' );
	return <FieldGeocoderControl { ...props } query={ query } onQueryChange={ setQuery } />;
}

describe( 'explicit public geocoder search', () => {
	let root;
	let container;
	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		mockTextControl.mockClear();
		mockGeocoderControl.mockClear();
	} );
	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'waits for Search and applies the selected location', async () => {
		const location = { latitude: 41.9, longitude: 12.5, address: 'Roma' };
		const geocoder = { requiresSubmit: true, search: jest.fn().mockResolvedValue( [ { value: '1', label: 'Roma', location } ] ), reverse: jest.fn() };
		const onChange = jest.fn();
		act( () => root.render( <Subject geocoder={ geocoder } onChange={ onChange } /> ) );
		act( () => mockTextControl.mock.lastCall[ 0 ].onChange( 'Roma' ) );
		expect( geocoder.search ).not.toHaveBeenCalled();
		expect( mockGeocoderControl.mock.lastCall[ 0 ].geocoder.search ).toBeUndefined();
		await act( async () => container.querySelector( 'button' ).click() );
		expect( geocoder.search ).toHaveBeenCalledTimes( 1 );
		expect( geocoder.search ).toHaveBeenCalledWith( 'Roma', expect.objectContaining( { signal: expect.anything() } ) );
		act( () => container.querySelector( 'li button' ).click() );
		expect( onChange ).toHaveBeenCalledWith( location, { type: 'select', query: 'Roma' } );
	} );

	it.each( [ 'query', 'unmount', 'provider' ] )( 'discards responses after %s changes', async ( change ) => {
		let resolve;
		const geocoder = { requiresSubmit: true, search: jest.fn( () => new Promise( ( finish ) => { resolve = finish; } ) ) };
		act( () => root.render( <Subject geocoder={ geocoder } onChange={ jest.fn() } /> ) );
		const preventDefault = jest.fn();
		act( () => mockTextControl.mock.lastCall[ 0 ].onKeyDown( { key: 'Enter', preventDefault } ) );
		expect( preventDefault ).toHaveBeenCalledTimes( 1 );
		act( () => {
			if ( change === 'query' ) {
				mockTextControl.mock.lastCall[ 0 ].onChange( 'Milan' );
			} else {
				root.render( change === 'unmount' ? null : <Subject geocoder={ { ...geocoder } } onChange={ jest.fn() } /> );
			}
		} );
		await act( async () => resolve( [ { value: '1', label: 'Outdated', location: {} } ] ) );
		expect( container.textContent ).not.toContain( 'Outdated' );
		expect( geocoder.search.mock.calls[ 0 ][ 1 ].signal.aborted ).toBe( true );
	} );

	it( 'keeps autocomplete available for a dedicated provider', () => {
		const geocoder = { requiresSubmit: false, search: jest.fn() };
		act( () => root.render( <Subject geocoder={ geocoder } onChange={ jest.fn() } /> ) );
		expect( mockGeocoderControl.mock.lastCall[ 0 ].geocoder ).toBe( geocoder );
		expect( mockTextControl ).not.toHaveBeenCalled();
	} );
} );
