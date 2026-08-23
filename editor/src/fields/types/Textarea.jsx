import { TextareaControl } from '@wordpress/components';

export default function Textarea( { field, value, onChange, onBlur } ) {
	return (
		<TextareaControl
			__nextHasNoMarginBottom
			label={ field.label }
			help={ field.description }
			placeholder={ field.placeholder }
			value={ value ?? '' }
			onChange={ onChange }
			onBlur={ onBlur }
			rows={ field.rows || 4 }
		/>
	);
}
