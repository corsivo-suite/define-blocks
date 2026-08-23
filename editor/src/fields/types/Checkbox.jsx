import { ToggleControl } from '@wordpress/components';
import { doAction } from '@wordpress/hooks';
import { useBlockContext } from '../../store/hooks';

export default function Checkbox( { name, field, value, onChange, onBlur } ) {
	const { blockName, clientId } = useBlockContext();
	const handleChange = ( checked ) => {
		onChange( checked );
		if ( onBlur ) { onBlur(); }
		doAction( `defb.toggle.${ blockName }.${ name }`, checked, clientId );
	};

	return (
		<ToggleControl
			__nextHasNoMarginBottom
			label={ field.label }
			help={ field.description }
			checked={ !! value }
			onChange={ handleChange }
		/>
	);
}
