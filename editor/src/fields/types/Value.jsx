import { TextControl } from '@wordpress/components';

export default function Value( { field, value } ) {
	return (
		<TextControl
			__next40pxDefaultSize
			label={ field.label }
			value={ value ?? '' }
			disabled
		/>
	);
}
