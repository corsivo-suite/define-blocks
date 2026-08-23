import { ToolbarDropdownMenu } from '@wordpress/components';

export default function ToolbarSelect( { field, value, onChange } ) {
	const options = field.options || [];
	const current = options.find( ( opt ) => String( opt.value ) === String( value ) ) || options[ 0 ];

	const controls = options.map( ( opt ) => ( {
		title: opt.label,
		icon: opt.icon,
		isActive: String( opt.value ) === String( value ),
		onClick: () => onChange( opt.value ),
	} ) );

	return (
		<ToolbarDropdownMenu
			icon={ current?.icon || field.icon || 'ellipsis' }
			label={ field.label }
			controls={ controls }
		/>
	);
}
