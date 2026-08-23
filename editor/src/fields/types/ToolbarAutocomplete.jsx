import { useState, useRef, useMemo } from '@wordpress/element';
import { ToolbarButton, Popover, ComboboxControl } from '@wordpress/components';
import { usePostsList } from '../shared/usePostsList';

export default function ToolbarAutocomplete( { field, value, onChange } ) {
	const [ open, setOpen ] = useState( false );
	const { posts } = usePostsList( field.postType );
	const buttonRef = useRef( null );

	const remoteOptions = useMemo( () => posts && posts.map( ( p ) => ( {
		label: p.title,
		value: String( p.id ),
	} ) ), [ posts ] );

	const staticOptions = useMemo( () => ( field.options || [] ).map( ( opt ) => {
		if ( typeof opt === 'string' ) { return { label: opt, value: opt }; }
		return opt;
	} ), [ field.options ] );

	const options = remoteOptions || staticOptions;

	const current = options.find( ( opt ) => String( opt.value ) === String( value ) );

	return (
		<>
			<ToolbarButton
				ref={ buttonRef }
				icon={ field.icon || 'search' }
				label={ current ? `${ field.label }: ${ current.label }` : field.label }
				onClick={ () => setOpen( ! open ) }
				isPressed={ open }
			/>
			{ open && (
				<Popover
					anchor={ buttonRef.current }
					placement="bottom-start"
					onClose={ () => setOpen( false ) }
					focusOnMount={ false }
				>
					<div style={ { padding: '12px', minWidth: '240px' } }>
						<ComboboxControl
							label={ field.label }
							value={ value ?? '' }
							options={ options }
							onChange={ ( val ) => {
								onChange( val );
								setOpen( false );
							} }
							__next40pxDefaultSize
							__nextHasNoMarginBottom
						/>
					</div>
				</Popover>
			) }
		</>
	);
}
