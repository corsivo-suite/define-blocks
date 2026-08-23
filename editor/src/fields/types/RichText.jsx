import { RichText as WPRichText } from '@wordpress/block-editor';
import { BaseControl } from '@wordpress/components';

export default function RichText( { name, field, value, onChange } ) {
	return (
		<BaseControl id={ name } label={ field.label } help={ field.description }>
			<WPRichText
				tagName={ field.tagName || 'div' }
				aria-label={ field.label }
				placeholder={ field.placeholder }
				value={ value ?? '' }
				onChange={ onChange }
				allowedFormats={ field.allowedFormats }
			/>
		</BaseControl>
	);
}
