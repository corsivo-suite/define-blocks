import { ToolbarDropdownMenu } from '@wordpress/components';
import { usePostsList } from '../shared/usePostsList';

export default function ToolbarSelect( { field, value, onChange, onBlur } ) {
	const { posts, loading } = usePostsList( field.postType );
	const options = posts
		? posts.map( ( post ) => ( { label: post.title, value: String( post.id ) } ) )
		: ( field.options || [] ).map( ( option ) =>
			typeof option === 'string' ? { label: option, value: option } : option
		);
	const current = options.find( ( opt ) => String( opt.value ) === String( value ) ) || options[ 0 ];

	const controls = options.map( ( opt ) => ( {
		title: opt.label,
		icon: opt.icon,
		isActive: String( opt.value ) === String( value ),
		isDisabled: loading,
		onClick: () => {
			onChange( opt.value );
			onBlur?.();
		},
	} ) );

	return (
		<ToolbarDropdownMenu
			icon={ current?.icon || field.icon || 'ellipsis' }
			label={ field.label }
			controls={ controls }
			toggleProps={ { disabled: loading } }
		/>
	);
}
