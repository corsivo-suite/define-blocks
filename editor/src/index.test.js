import { registerBlockType } from '@wordpress/blocks';
import { observeDocumentValidation } from './store/document-validation';

jest.mock( '@wordpress/blocks', () => ( { registerBlockType: jest.fn() } ), {
	virtual: true,
} );
jest.mock(
	'@wordpress/block-editor',
	() => ( {
		InnerBlocks: { Content: () => null },
		store: 'core/block-editor',
	} ),
	{ virtual: true }
);
jest.mock( '@wordpress/editor', () => ( { store: 'core/editor' } ), {
	virtual: true,
} );
jest.mock(
	'@wordpress/hooks',
	() => ( { applyFilters: ( name, settings ) => settings } ),
	{ virtual: true }
);
jest.mock(
	'@wordpress/data',
	() => ( { select: jest.fn(), dispatch: jest.fn(), subscribe: jest.fn() } ),
	{ virtual: true }
);
jest.mock( './store/document-validation', () => ( {
	observeDocumentValidation: jest.fn(),
} ) );
jest.mock( './block/Edit', () => () => null );
jest.mock( '@corsivo-suite/wp-admin-ui/styles.css', () => ( {} ) );
jest.mock( '@corsivo-suite/wp-admin-maps/leaflet.css', () => ( {} ) );
jest.mock( './styles/index.scss', () => ( {} ) );

describe( 'native block registration', () => {
	it( 'forwards parent, ancestor and native context without creating duplicate attributes', () => {
		const definition = {
			name: 'demo/child',
			title: 'Child',
			parent: [ 'demo/parent' ],
			ancestor: [ 'demo/section' ],
			usesContext: [ 'postId', 'demo/theme' ],
			providesContext: { 'demo/settings': 'values' },
			_schema: { content: { fields: {} } },
			_defaults: { title: 'Default' },
		};
		window.defineBlocks = { blocks: { 'demo/child': definition } };
		window.DefineBlocks = {};
		require( './index' );
		expect( registerBlockType ).toHaveBeenCalledWith(
			'demo/child',
			expect.objectContaining( {
				apiVersion: 3,
				parent: definition.parent,
				ancestor: definition.ancestor,
				usesContext: definition.usesContext,
				providesContext: definition.providesContext,
			} )
		);
		expect(
			Object.keys( registerBlockType.mock.lastCall[ 1 ].attributes )
		).toEqual( [ 'values', 'isPreview', 'collapsed' ] );
		expect( observeDocumentValidation ).toHaveBeenCalledTimes( 1 );
	} );
} );
