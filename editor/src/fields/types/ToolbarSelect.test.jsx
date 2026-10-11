import { createRoot } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import ToolbarSelect from './ToolbarSelect';

const { act } = jest.requireActual( 'react' );
const mockDropdown = jest.fn( () => null );

jest.mock( '@wordpress/api-fetch', () => jest.fn(), { virtual: true } );
jest.mock( '@wordpress/url', () => ( {
	addQueryArgs: ( path, query ) => `${ path }?${ new URLSearchParams( query ) }`,
} ), { virtual: true } );
jest.mock( '@wordpress/components', () => ( {
	ToolbarDropdownMenu: ( props ) => mockDropdown( props ),
} ), { virtual: true } );

describe( 'toolbar select options', () => {
	let root;
	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		root = createRoot( document.createElement( 'div' ) );
		mockDropdown.mockClear();
		apiFetch.mockReset();
	} );
	afterEach( () => act( () => root.unmount() ) );

	it( 'loads post options and saves their string ids', async () => {
		let resolve;
		apiFetch.mockImplementation( () => new Promise( ( finish ) => { resolve = finish; } ) );
		const onChange = jest.fn();
		const onBlur = jest.fn();
		act( () => root.render( <ToolbarSelect field={ { label: 'Project', postType: 'project' } } value={ 12 } onChange={ onChange } onBlur={ onBlur } /> ) );
		expect( apiFetch ).toHaveBeenCalledWith( { path: '/defb/v1/posts/list?post_type=project' } );
		expect( mockDropdown.mock.lastCall[ 0 ].toggleProps.disabled ).toBe( true );
		await act( async () => resolve( [ { id: 12, title: 'First project' }, { id: 15, title: 'Second project' } ] ) );
		const dropdown = mockDropdown.mock.lastCall[ 0 ];
		expect( dropdown.toggleProps.disabled ).toBe( false );
		expect( dropdown.controls.map( ( option ) => [ option.title, option.isActive ] ) ).toEqual( [ [ 'First project', true ], [ 'Second project', false ] ] );
		act( () => dropdown.controls[ 1 ].onClick() );
		expect( onChange ).toHaveBeenCalledWith( '15' );
		expect( onBlur ).toHaveBeenCalledTimes( 1 );
	} );

	it( 'keeps static string options and icons available', () => {
		const onChange = jest.fn();
		act( () => root.render( <ToolbarSelect field={ { label: 'Style', options: [ 'Plain', { label: 'Bold', value: 'bold', icon: 'bold' } ] } } value="bold" onChange={ onChange } /> ) );
		const dropdown = mockDropdown.mock.lastCall[ 0 ];
		expect( apiFetch ).not.toHaveBeenCalled();
		expect( dropdown.icon ).toBe( 'bold' );
		expect( dropdown.controls[ 0 ].title ).toBe( 'Plain' );
		act( () => dropdown.controls[ 0 ].onClick() );
		expect( onChange ).toHaveBeenCalledWith( 'Plain' );
	} );
} );
