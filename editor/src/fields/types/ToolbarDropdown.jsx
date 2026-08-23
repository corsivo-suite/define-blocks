import { ToolbarDropdownMenu, MenuGroup, MenuItem } from '@wordpress/components';

export default function ToolbarDropdown( { field, value, onChange } ) {
	const options = field.options || [];

	return (
		<ToolbarDropdownMenu
			icon={ field.icon || 'arrow-down-alt2' }
			label={ field.label }
		>
			{ ( { onClose } ) => (
				<MenuGroup>
					{ options.map( ( opt ) => (
						<MenuItem
							key={ opt.value }
							icon={ String( opt.value ) === String( value ) ? 'yes' : undefined }
							isSelected={ String( opt.value ) === String( value ) }
							onClick={ () => {
								onChange( opt.value );
								onClose();
							} }
						>
							{ opt.label }
						</MenuItem>
					) ) }
				</MenuGroup>
			) }
		</ToolbarDropdownMenu>
	);
}
