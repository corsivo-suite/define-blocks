import { createRoot } from '@wordpress/element';
// eslint-disable-next-line import/no-extraneous-dependencies
import { act } from 'react';
import apiFetch from '@wordpress/api-fetch';
import TaxonomyField from './TaxonomyField';

const mockControl = jest.fn( () => null );
const mockErrorNotice = jest.fn();

jest.mock( '@wordpress/api-fetch', () => jest.fn(), { virtual: true } );
jest.mock( '@wordpress/data', () => ( {
	useDispatch: () => ( { createErrorNotice: mockErrorNotice } ),
	useSelect: () => ( {
		rest_base: 'categories',
		rest_namespace: 'wp/v2',
	} ),
} ), { virtual: true } );
jest.mock( '@corsivo-suite/wp-admin-ui/creatable-sortable-multi-select', () => ( {
	CreatableSortableMultiSelect: ( props ) => mockControl( props ),
} ) );

describe( 'TaxonomyField', () => {
	let container;
	let root;

	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		apiFetch.mockReset();
		mockControl.mockClear();
		mockErrorNotice.mockClear();
	} );

	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'hydrates selected terms while preserving their stored fallback', async () => {
		apiFetch.mockResolvedValue( [ {
			id: 12,
			name: 'News',
			path: 'Company › News',
		} ] );
		act( () => {
			root.render(
				<TaxonomyField
					name="categories"
					field={ { taxonomy: 'category' } }
					value={ [ { value: '12', label: 'Saved label' } ] }
					onChange={ jest.fn() }
				/>
			);
		} );

		const controlProps = mockControl.mock.lastCall[ 0 ];
		expect( controlProps.createFallbackOption( '12' ) ).toEqual( {
			value: '12',
			label: 'Saved label',
		} );
		await expect( controlProps.resolveValues( [ '12' ], {
			signal: new AbortController().signal,
		} ) ).resolves.toEqual( [ {
			value: '12',
			label: 'Company › News',
		} ] );
		expect( apiFetch ).toHaveBeenCalledWith( expect.objectContaining( {
			path: expect.stringContaining( 'include=12' ),
		} ) );
	} );

	it.each( [ 'created', 'existing' ] )( 'keeps removals made while a term is being %s', async ( outcome ) => {
		let finish;
		apiFetch.mockImplementation( () => new Promise( ( resolve, reject ) => {
			finish = () => outcome === 'created'
				? resolve( { id: 99, name: 'New term' } )
				: reject( { code: 'term_exists', data: { term_id: 99 } } );
		} ) );
		const onChange = jest.fn();
		act( () => root.render( <TaxonomyField name="terms" field={ { allowCreate: true } } value={ [ { value: '12', label: 'Old' } ] } onChange={ onChange } /> ) );
		const change = mockControl.mock.lastCall[ 0 ].onChange;
		const option = { value: 'New term', label: 'New term' };
		const pending = change( [ '12', 'New term' ], [ { value: '12', label: 'Old' }, option ], { type: 'create', option } );
		await act( async () => change( [], [], { type: 'remove' } ) );
		await act( async () => {
			finish();
			await pending;
		} );
		expect( onChange ).toHaveBeenLastCalledWith( [ { value: '99', label: 'New term' } ] );
	} );

	it( 'preserves concurrent term creations completed in reverse order', async () => {
		const responses = [];
		apiFetch.mockImplementation( () => new Promise( ( resolve ) => responses.push( resolve ) ) );
		const onChange = jest.fn();
		act( () => root.render( <TaxonomyField name="terms" field={ { allowCreate: true } } value={ [] } onChange={ onChange } /> ) );
		const change = mockControl.mock.lastCall[ 0 ].onChange;
		const first = change( [ 'A' ], [ { value: 'A', label: 'A' } ], { type: 'create', option: { value: 'A', label: 'A' } } );
		const second = change( [ 'B' ], [ { value: 'B', label: 'B' } ], { type: 'create', option: { value: 'B', label: 'B' } } );
		await act( async () => { responses[ 1 ]( { id: 2, name: 'B' } ); await second; } );
		await act( async () => { responses[ 0 ]( { id: 1, name: 'A' } ); await first; } );
		expect( onChange ).toHaveBeenLastCalledWith( [ { value: '2', label: 'B' }, { value: '1', label: 'A' } ] );
	} );

	it.each( [ 'unmount', 'taxonomy' ] )( 'ignores a late creation after %s changes', async ( changeType ) => {
		let finish;
		apiFetch.mockImplementation( () => new Promise( ( resolve ) => { finish = resolve; } ) );
		const onChange = jest.fn();
		act( () => root.render( <TaxonomyField name="terms" field={ { allowCreate: true } } value={ [] } onChange={ onChange } /> ) );
		const pending = mockControl.mock.lastCall[ 0 ].onChange( [ 'A' ], [], { type: 'create', option: { value: 'A', label: 'A' } } );
		act( () => root.render( changeType === 'unmount' ? null : <TaxonomyField name="terms" field={ { allowCreate: true, taxonomy: 'post_tag' } } value={ [] } onChange={ onChange } /> ) );
		await act( async () => { finish( { id: 1, name: 'A' } ); await pending; } );
		expect( onChange ).not.toHaveBeenCalled();
		expect( mockErrorNotice ).not.toHaveBeenCalled();
		expect( apiFetch.mock.calls[ 0 ][ 0 ].signal.aborted ).toBe( true );
	} );
} );
