import { __ } from '@wordpress/i18n';
import { FileControl } from '@corsivo-suite/wp-admin-ui/file-control';
import { renderWordPressMediaPicker } from './media-picker';
import { normalizeMediaValue } from './value-contracts';

export default function FileField( { name, field, value, onChange, onBlur } ) {
	const file = value && typeof value === 'object' && Object.keys( value ).length ? value : null;

	return (
		<FileControl
			id={ name }
			label={ field.label }
			help={ field.description }
			value={ file }
			onChange={ ( selection ) => onChange(
				selection ? normalizeMediaValue( selection, 'file' ) : {}
			) }
			onBlur={ onBlur }
			renderMediaPicker={ renderWordPressMediaPicker }
			allowedTypes={ field.allowedTypes }
			getFileLabel={ ( selectedFile ) => selectedFile.name || selectedFile.url }
			selectLabel={ field.buttonLabel || __( 'Select File', 'define-blocks' ) }
			replaceLabel={ __( 'Replace', 'define-blocks' ) }
			removeLabel={ __( 'Remove', 'define-blocks' ) }
		/>
	);
}
