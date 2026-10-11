import { createRoot } from '@wordpress/element';
// eslint-disable-next-line import/no-extraneous-dependencies
import { act } from 'react';
import { doAction } from '@wordpress/hooks';
import FieldErrorBoundary from './FieldErrorBoundary';

jest.mock( '@wordpress/hooks', () => ( {
	doAction: jest.fn(),
} ) );

function BrokenField() {
	throw new Error( 'broken field' );
}

describe( 'FieldErrorBoundary', () => {
	let container;
	let root;
	let consoleError;

	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		window.defineBlocks = { debug: false };
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		consoleError = jest.spyOn( window.console, 'error' ).mockImplementation( () => {} );
		doAction.mockClear();
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
		consoleError.mockRestore();
	} );

	it( 'isolates render failures and emits the diagnostic hook', () => {
		act( () => {
			root.render(
				<FieldErrorBoundary fieldName="location" fieldType="osm-map">
					<BrokenField />
				</FieldErrorBoundary>
			);
		} );

		expect( container.querySelector( '[role="alert"]' )?.textContent ).toBe(
			'This field could not be loaded.'
		);
		expect( doAction ).toHaveBeenCalledWith(
			'defb.fieldRenderError',
			expect.any( Error ),
			expect.objectContaining( {
				fieldName: 'location',
				fieldType: 'osm-map',
			} )
		);
	} );
} );
