import { MediaUpload, MediaUploadCheck } from '@wordpress/block-editor';

export function renderWordPressMediaPicker( {
	value,
	multiple,
	allowedTypes,
	onSelect,
	renderTrigger,
} ) {
	const mediaValue = multiple
		? ( Array.isArray( value ) ? value : [] ).map( ( media ) => media?.id ?? media?.ID ).filter( Boolean )
		: value?.id ?? value?.ID ?? 0;

	return (
		<MediaUploadCheck>
			<MediaUpload
				onSelect={ onSelect }
				allowedTypes={ allowedTypes }
				multiple={ multiple }
				gallery={ multiple }
				value={ mediaValue }
				render={ ( { open } ) => renderTrigger( { open } ) }
			/>
		</MediaUploadCheck>
	);
}
