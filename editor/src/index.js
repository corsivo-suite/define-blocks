import { registerBlockType } from '@wordpress/blocks';
import {
	InnerBlocks,
	store as blockEditorStore,
} from '@wordpress/block-editor';
import { store as editorStore } from '@wordpress/editor';
import { applyFilters } from '@wordpress/hooks';
import { select, dispatch, subscribe } from '@wordpress/data';
import Edit from './block/Edit';
import { setupRuntime } from './engine/runtime';
import { schemaHasFieldType } from './engine/schema';
import { observeDocumentValidation } from './store/document-validation';
import '@corsivo-suite/wp-admin-ui/styles.css';
import '@corsivo-suite/wp-admin-maps/leaflet.css';
import './styles/index.scss';

setupRuntime();

const { blocks = {} } = window.defineBlocks || {};

Object.entries( blocks ).forEach( ( [ name, blockData ] ) => {
	const schema = blockData._schema || {};
	const defaults = blockData._defaults || {};

	const blockSettings = blockData.settings || {};
	const hasInnerBlocks = schemaHasFieldType( schema, 'innerblocks' );

	let settings = {
		apiVersion: 3,
		title: blockData.title || name,
		description: blockData.description || '',
		icon: blockData.icon || 'block-default',
		category: blockData.category || 'widgets',
		keywords: blockData.keywords || [],
		supports: blockData.supports || {},
		parent: blockData.parent,
		ancestor: blockData.ancestor,
		usesContext: blockData.usesContext,
		providesContext: blockData.providesContext,
		attributes: {
			values: { type: 'object', default: defaults },
			isPreview: {
				type: 'boolean',
				default: !! blockSettings.startPreview,
			},
			collapsed: { type: 'boolean', default: false },
		},
		edit: ( props ) => (
			<Edit { ...props } blockData={ blockData } schema={ schema } />
		),
		save: hasInnerBlocks ? () => <InnerBlocks.Content /> : () => null,
	};

	settings = applyFilters( 'defb.blockSettings', settings, name, blockData );

	registerBlockType( name, settings );

	window.DefineBlocks.Registry[ name ] = blockData;
} );

observeDocumentValidation( {
	getBlocks: () => select( blockEditorStore ).getBlocks(),
	getDefinition: ( name ) => window.DefineBlocks.Registry[ name ],
	subscribe: ( listener ) => subscribe( listener, 'core/block-editor' ),
	lockSaving: () =>
		dispatch( editorStore ).lockPostSaving( 'define-blocks-validation' ),
	unlockSaving: () =>
		dispatch( editorStore ).unlockPostSaving( 'define-blocks-validation' ),
} );
