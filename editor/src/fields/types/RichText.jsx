import { RichText as WPRichText } from '@wordpress/block-editor';
import { BaseControl } from '@wordpress/components';

export default function RichText( { id, field, value, onChange } ) {
	return (
		<BaseControl id={ id } label={ field.label } help={ field.description }>
			<WPRichText
				id={ id }
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
