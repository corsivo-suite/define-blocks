import { createRoot } from '@wordpress/element';
import TabPanels from './TabPanels';

const { act } = jest.requireActual( 'react' );
const mockMounts = {};
const mockUnmounts = {};
let mockUseRealTabPanel = false;

jest.mock( 'uuid', () => {
	let nextId = 0;
	return { v4: () => `tab-panel-${ String.fromCharCode( 97 + nextId++ ) }` };
} );

jest.mock( '@wordpress/components', () => {
	const { useState } = jest.requireActual( 'react' );
	const { dirname, join } = jest.requireActual( 'path' );
	const componentsDirectory = dirname( require.resolve( '@wordpress/components/package.json' ) );
	const RealTabPanel = jest.requireActual( join( componentsDirectory, 'build', 'tab-panel', 'index.cjs' ) ).default;
	function MockTabPanel( { tabs, children } ) {
		const [ selected, setSelected ] = useState( tabs[ 0 ].name );
		return (
			<>
				{ tabs.map( ( tab ) => <button key={ tab.name } onClick={ () => setSelected( tab.name ) }>{ tab.title }</button> ) }
				{ children( tabs.find( ( tab ) => tab.name === selected ) ) }
			</>
		);
	}
	return {
		BaseControl: ( { children } ) => children,
		TabPanel: ( props ) => {
			const Component = mockUseRealTabPanel ? RealTabPanel : MockTabPanel;
			return <Component { ...props } />;
		},
	};
}, { virtual: true } );

jest.mock( '../Dispatcher', () => {
	const { useEffect } = jest.requireActual( 'react' );
	return {
		__esModule: true,
		default: function Dispatcher( { name, field } ) {
			useEffect( () => {
				mockMounts[ name ] = ( mockMounts[ name ] || 0 ) + 1;
				return () => { mockUnmounts[ name ] = ( mockUnmounts[ name ] || 0 ) + 1; };
			}, [ name ] );
			if ( field.type === 'group' ) {
				const Renderer = require( '../Renderer' ).default;
				return <Renderer fields={ field.fields } />;
			}
			if ( field.type === 'tabpanels' ) {
				const Tabs = require( './TabPanels' ).default;
				return <Tabs field={ field } />;
			}
			return <span data-field-name={ name }>{ name }</span>;
		},
	};
} );

describe( 'tab panels with InnerBlocks', () => {
	let root;
	let container;
	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		container = document.createElement( 'div' );
		document.body.appendChild( container );
		root = createRoot( container );
		mockUseRealTabPanel = false;
		Object.keys( mockMounts ).forEach( ( name ) => delete mockMounts[ name ] );
		Object.keys( mockUnmounts ).forEach( ( name ) => delete mockUnmounts[ name ] );
	} );
	afterEach( () => {
		act( () => root.unmount() );
		container.remove();
	} );

	it( 'mounts inactive InnerBlocks immediately and preserves them when switching tabs', () => {
		const field = { tabs: {
			settings: { title: 'Settings', fields: { title: { type: 'text' } } },
			content: { title: 'Content', fields: { children: { type: 'innerblocks', template: [ [ 'core/paragraph' ] ] }, map: { type: 'osm-map' } } },
		} };
		act( () => root.render( <TabPanels field={ field } /> ) );
		const innerBlocks = container.querySelector( '[data-field-name="children"]' );
		expect( innerBlocks.closest( '[hidden]' ) ).not.toBeNull();
		expect( mockMounts.children ).toBe( 1 );
		expect( mockMounts.map ).toBeUndefined();
		act( () => container.querySelectorAll( 'button' )[ 1 ].click() );
		expect( innerBlocks.closest( '[hidden]' ) ).toBeNull();
		expect( mockMounts.children ).toBe( 1 );
		expect( mockMounts.map ).toBe( 1 );
		act( () => container.querySelectorAll( 'button' )[ 0 ].click() );
		expect( container.querySelector( '[data-field-name="children"]' ) ).toBe( innerBlocks );
		expect( mockUnmounts.children ).toBeUndefined();
		expect( mockUnmounts.map ).toBe( 1 );
	} );

	it( 'preserves only the InnerBlocks branch inside groups and nested tabs', () => {
		const field = { tabs: {
			settings: { title: 'Settings', fields: { title: { type: 'text' } } },
			content: { title: 'Content', fields: { group: { type: 'group', fields: {
				map: { type: 'osm-map' },
				nested: { type: 'tabpanels', tabs: {
					other: { title: 'Other', fields: { video: { type: 'video' } } },
					children: { title: 'Children', fields: { children: { type: 'innerblocks' } } },
				} },
			} } } },
		} };
		act( () => root.render( <TabPanels field={ field } /> ) );
		expect( mockMounts.children ).toBe( 1 );
		expect( mockMounts.map ).toBeUndefined();
		expect( mockMounts.video ).toBeUndefined();
		const innerBlocks = container.querySelector( '[data-field-name="children"]' );
		act( () => container.querySelectorAll( 'button' )[ 1 ].click() );
		expect( mockMounts.video ).toBe( 1 );
		expect( mockMounts.map ).toBe( 1 );
		expect( container.querySelector( '[data-field-name="children"]' ) ).toBe( innerBlocks );
		act( () => container.querySelectorAll( 'button' )[ 0 ].click() );
		expect( container.querySelector( '[data-field-name="children"]' ) ).toBe( innerBlocks );
		expect( mockUnmounts.children ).toBeUndefined();
	} );

	it( 'preserves the inactive template branch through the real WordPress TabPanel', async () => {
		mockUseRealTabPanel = true;
		const field = { tabs: {
			settings: { title: 'Settings', fields: { title: { type: 'text' } } },
			content: { title: 'Content', fields: { children: { type: 'innerblocks' }, map: { type: 'osm-map' } } },
		} };
		await act( async () => root.render( <TabPanels field={ field } /> ) );
		const innerBlocks = container.querySelector( '[data-field-name="children"]' );
		expect( innerBlocks ).not.toBeNull();
		expect( innerBlocks.closest( '[hidden]' ) ).not.toBeNull();
		expect( mockMounts.children ).toBe( 1 );
		await act( async () => container.querySelectorAll( '[role="tab"]' )[ 1 ].click() );
		expect( innerBlocks.closest( '[hidden]' ) ).toBeNull();
		expect( mockMounts.map ).toBe( 1 );
		await act( async () => container.querySelectorAll( '[role="tab"]' )[ 0 ].click() );
		expect( container.querySelector( '[data-field-name="children"]' ) ).toBe( innerBlocks );
		expect( mockMounts.children ).toBe( 1 );
		expect( mockUnmounts.children ).toBeUndefined();
	} );
} );
