import { createRoot } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import BlockPreview from './BlockPreview';

const { act } = jest.requireActual( 'react' );

let mockBlocks = [];
let sequence = 0;

jest.mock( '@wordpress/api-fetch', () => jest.fn(), { virtual: true } );
jest.mock(
	'@wordpress/data',
	() => ( {
		useSelect: ( selector ) =>
			selector( ( store ) =>
				store === 'core/editor'
					? { getCurrentPostId: () => 12 }
					: { getBlocks: () => mockBlocks }
			),
	} ),
	{ virtual: true }
);
jest.mock(
	'@wordpress/blocks',
	() => ( { serialize: ( blocks ) => JSON.stringify( blocks ) } ),
	{ virtual: true }
);
jest.mock( '../store/hooks', () => ( {
	useBlockContext: () => ( { clientId: 'preview' } ),
} ) );
jest.mock( '@wordpress/components', () => ( {
	Spinner: () => <span role="status">Loading</span>,
	Button: ( { children, onClick } ) => (
		<button onClick={ onClick }>{ children }</button>
	),
	Notice: ( { children } ) => <div role="alert">{ children }</div>,
} ) );

describe( 'BlockPreview requests', () => {
	let container;
	let root;
	let blockName;
	let render;

	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		jest.useFakeTimers();
		apiFetch.mockReset();
		mockBlocks = [];
		blockName = `demo/preview-${ ++sequence }`;
		container = document.createElement( 'div' );
		root = createRoot( container );
		render = ( values, context = {} ) =>
			root.render(
				<BlockPreview
					blockName={ blockName }
					attributes={ { values, isPreview: true } }
					context={ context }
					onRestore={ jest.fn() }
				/>
			);
	} );

	afterEach( () => {
		act( () => root.unmount() );
		jest.useRealTimers();
	} );

	it( 'debounces typing and sends the final attributes with native context and children', async () => {
		apiFetch.mockResolvedValue( '<p>Final</p>' );
		const context = { postId: 99, postType: 'page', 'demo/theme': 'dark' };
		mockBlocks = [
			{ name: 'core/paragraph', attributes: { content: 'Nested' } },
		];
		act( () => render( { title: 'F' }, context ) );
		act( () => jest.advanceTimersByTime( 100 ) );
		act( () => render( { title: 'Final' }, context ) );
		act( () => jest.advanceTimersByTime( 249 ) );
		expect( apiFetch ).not.toHaveBeenCalled();
		await act( async () => jest.advanceTimersByTime( 1 ) );
		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
		expect( apiFetch.mock.lastCall[ 0 ].data ).toEqual( {
			blockName,
			post_id: 99,
			attributes: { values: { title: 'Final' } },
			content: JSON.stringify( mockBlocks ),
			context,
		} );
		expect( container.textContent ).toBe( 'Final' );
	} );

	it( 'keeps the last HTML visible while rejecting responses from cancelled requests', async () => {
		const requests = [];
		apiFetch.mockImplementation(
			( request ) =>
				new Promise( ( resolve ) =>
					requests.push( { request, resolve } )
				)
		);
		act( () => render( { title: 'First' } ) );
		act( () => jest.advanceTimersByTime( 250 ) );
		await act( async () => requests[ 0 ].resolve( '<p>First</p>' ) );
		act( () => render( { title: 'Second' } ) );
		expect( container.textContent ).toBe( 'First' );
		expect(
			container.querySelector( '[aria-busy="true"]' )
		).not.toBeNull();
		act( () => jest.advanceTimersByTime( 250 ) );
		act( () => render( { title: 'Third' } ) );
		expect( requests[ 1 ].request.signal.aborted ).toBe( true );
		act( () => jest.advanceTimersByTime( 250 ) );
		await act( async () => requests[ 2 ].resolve( '<p>Third</p>' ) );
		await act( async () => requests[ 1 ].resolve( '<p>Stale second</p>' ) );
		expect( container.textContent ).toBe( 'Third' );
	} );

	it( 'reuses an unchanged preview but invalidates it for context and InnerBlocks changes', async () => {
		apiFetch.mockResolvedValue( '<p>Cached</p>' );
		act( () => render( { title: 'A' } ) );
		await act( async () => jest.advanceTimersByTime( 250 ) );
		act( () => render( { title: 'B' } ) );
		act( () => render( { title: 'A' } ) );
		await act( async () => jest.advanceTimersByTime( 250 ) );
		expect( apiFetch ).toHaveBeenCalledTimes( 1 );
		act( () => render( { title: 'A' }, { 'demo/theme': 'light' } ) );
		await act( async () => jest.advanceTimersByTime( 250 ) );
		expect( apiFetch ).toHaveBeenCalledTimes( 2 );
		mockBlocks = [
			{
				name: 'core/paragraph',
				attributes: { content: 'Changed child' },
			},
		];
		act( () => render( { title: 'A' }, { 'demo/theme': 'light' } ) );
		await act( async () => jest.advanceTimersByTime( 250 ) );
		expect( apiFetch ).toHaveBeenCalledTimes( 3 );
	} );

	it( 'aborts an active request on unmount', async () => {
		let resolveRequest;
		apiFetch.mockImplementation(
			() =>
				new Promise( ( resolve ) => {
					resolveRequest = resolve;
				} )
		);
		act( () => render( { title: 'Pending' } ) );
		act( () => jest.advanceTimersByTime( 250 ) );
		const signal = apiFetch.mock.lastCall[ 0 ].signal;
		act( () => root.render( null ) );
		expect( signal.aborted ).toBe( true );
		await act( async () => resolveRequest( '<p>Too late</p>' ) );
		expect( container.innerHTML ).toBe( '' );
	} );
} );
