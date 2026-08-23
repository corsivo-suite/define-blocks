import { SelectControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { usePostsList } from '../shared/usePostsList';

export default function Select( { field, value, onChange, onBlur } ) {
	const { posts, loading } = usePostsList( field.postType );

	const remoteOptions = posts && posts.map( ( p ) => ( {
		label: p.title,
		value: String( p.id ),
	} ) );

	const staticOptions = ( field.options || [] ).map( ( opt ) => {
		if ( typeof opt === 'string' ) {
			return { label: opt, value: opt };
		}
		return opt;
	} );

	const options = remoteOptions || staticOptions;
	const hasEmpty = options.some( ( opt ) => opt.value === '' );

	return (
		<SelectControl
			__next40pxDefaultSize
			__nextHasNoMarginBottom
			label={ field.label }
			help={ field.description }
			value={ value ?? '' }
			options={ hasEmpty ? options : [ { label: field.placeholder || __( '— Select —', 'define-blocks' ), value: '' }, ...options ] }
			disabled={ loading }
			onChange={ ( val ) => { onChange( val ); if ( onBlur ) { onBlur(); } } }
		/>
	);
}
