import { registerBlockType } from '@wordpress/blocks';
import { InnerBlocks } from '@wordpress/block-editor';
import { applyFilters } from '@wordpress/hooks';
import Edit from './block/Edit';
import { setupRuntime } from './engine/runtime';
import { schemaHasFieldType } from './engine/schema';
import '@corsivo-suite/wp-admin-ui/styles.css';
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
		attributes: {
			values: { type: 'object', default: defaults },
			isPreview: { type: 'boolean', default: !! blockSettings.startPreview },
			collapsed: { type: 'boolean', default: false },
		},
		edit: ( props ) => <Edit { ...props } blockData={ blockData } schema={ schema } />,
		save: hasInnerBlocks ? () => <InnerBlocks.Content /> : () => null,
	};

	settings = applyFilters( 'defb.blockSettings', settings, name, blockData );

	registerBlockType( name, settings );

	window.DefineBlocks.Registry[ name ] = blockData;
} );
