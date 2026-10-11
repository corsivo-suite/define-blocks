import { createRoot } from '@wordpress/element';
import Edit from './Edit';

const { act } = jest.requireActual( 'react' );

const mockMount = jest.fn();
const mockUnmount = jest.fn();

jest.mock( '@wordpress/hooks', () => ( { doAction: jest.fn() } ), {
	virtual: true,
} );
jest.mock(
	'@wordpress/block-editor',
	() => ( {
		useBlockProps: ( props ) => props,
		BlockControls: ( { children } ) => <div>{ children }</div>,
		InspectorControls: ( { children } ) => <div>{ children }</div>,
	} ),
	{ virtual: true }
);
jest.mock( '@wordpress/components', () => ( {
	PanelBody: ( { children } ) => <div>{ children }</div>,
	ToolbarGroup: ( { children } ) => <div>{ children }</div>,
	ToolbarButton: ( { label, onClick } ) => (
		<button onClick={ onClick }>{ label }</button>
	),
	Dropdown: () => null,
	Icon: () => null,
} ) );
jest.mock( './BlockPreview', () => () => <div data-preview>Preview</div> );
jest.mock( '../fields/Dispatcher', () => () => null );
jest.mock(
	'../fields/Renderer',
	() =>
		function TemplateFields() {
			const { useEffect: useMountEffect } =
				jest.requireActual( '@wordpress/element' );
			useMountEffect( () => {
				mockMount();
				return mockUnmount;
			}, [] );
			return <div data-innerblocks>Template content</div>;
		}
);

describe( 'Edit content lifecycle', () => {
	let container;
	let root;

	beforeEach( () => {
		window.IS_REACT_ACT_ENVIRONMENT = true;
		window.DefineBlocks = { Instances: {} };
		container = document.createElement( 'div' );
		root = createRoot( container );
		mockMount.mockClear();
		mockUnmount.mockClear();
	} );

	afterEach( () => act( () => root.unmount() ) );

	it( 'initializes template fields in startPreview and preserves their mount through collapse and preview', () => {
		const blockData = {
			name: 'demo/template',
			settings: { frontendPreview: true, canCollapse: true },
			_defaults: {},
		};
		const schema = {
			content: {
				fields: {
					content: {
						type: 'innerblocks',
						template: [ [ 'core/paragraph' ] ],
					},
				},
			},
		};
		const render = ( attributes ) =>
			root.render(
				<Edit
					clientId="parent"
					attributes={ { values: {}, ...attributes } }
					setAttributes={ jest.fn() }
					blockData={ blockData }
					schema={ schema }
				/>
			);
		act( () => render( { isPreview: true } ) );
		expect( mockMount ).toHaveBeenCalledTimes( 1 );
		expect(
			container
				.querySelector( '[data-innerblocks]' )
				.closest( '[hidden]' )
		).not.toBeNull();
		act( () => render( { isPreview: false, collapsed: true } ) );
		expect(
			container
				.querySelector( '[data-innerblocks]' )
				.closest( '[hidden]' )
		).not.toBeNull();
		act( () => render( { isPreview: false, collapsed: false } ) );
		expect(
			container
				.querySelector( '[data-innerblocks]' )
				.closest( '[hidden]' )
		).toBeNull();
		expect( mockMount ).toHaveBeenCalledTimes( 1 );
		expect( mockUnmount ).not.toHaveBeenCalled();
	} );
} );
