import { ToolbarButton } from '@wordpress/components';
import { doAction } from '@wordpress/hooks';
import { useBlockContext } from '../../store/hooks';

export default function ToolbarToggle( { name, field, value, onChange } ) {
	const { blockName, clientId } = useBlockContext();
	const handleClick = () => {
		const next = ! value;
		onChange( next );
		doAction( `defb.toggle.${ blockName }.${ name }`, next, clientId );
		doAction( 'defb.toolbar.toggle', name, next );
	};

	return (
		<ToolbarButton
			icon={ field.icon || 'marker' }
			label={ field.label }
			isPressed={ !! value }
			onClick={ handleClick }
		/>
	);
}
