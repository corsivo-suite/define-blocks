import { TextControl } from '@wordpress/components';
import { applyFilters } from '@wordpress/hooks';
import { normalizeNumericValue } from '../../engine/values';

export default function TextInput( {
	id,
	name,
	field,
	type,
	value,
	onChange,
	onBlur,
} ) {
	const isNumber = field.originalType === 'number' || type === 'number';

	const handleChange = ( next ) => {
		if ( field.sanitized ) {
			next = next.replace( /<[^>]*>/g, '' );
		}
		if ( type === 'text-with-parser' && field.parser ) {
			next = applyFilters(
				`defb.parse.${ field.parser }`,
				next,
				name,
				field
			);
		}
		onChange( isNumber ? normalizeNumericValue( next ) : next );
	};

	return (
		<TextControl
			id={ id }
			__next40pxDefaultSize
			label={ field.label }
			help={ field.description }
			placeholder={ field.placeholder }
			value={ value ?? '' }
			onChange={ handleChange }
			onBlur={ onBlur }
			maxLength={ field.maxLength }
			type={ isNumber ? 'number' : 'text' }
			min={ isNumber ? field.min : undefined }
			max={ isNumber ? field.max : undefined }
			step={ isNumber ? field.step : undefined }
		/>
	);
}
