import { InnerBlocks } from '@wordpress/block-editor';

export default function InnerBlocksField( { field } ) {
	return (
		<InnerBlocks
			allowedBlocks={ field.allowedBlocks }
			template={ field.template }
			templateLock={ field.templateLock }
			orientation={ field.orientation }
		/>
	);
}
