import { __ } from '@wordpress/i18n';
import { VideoControl } from '@corsivo-suite/wp-admin-ui/video-control';
import { getVideoEmbedUrl } from './video-preview';

export default function VideoField( { id, field, value, onChange, onBlur } ) {
	return (
		<VideoControl
			id={ id }
			label={ field.label }
			help={ field.description }
			value={ value ?? '' }
			onChange={ onChange }
			onBlur={ onBlur }
			placeholder={ field.placeholder || 'https://youtube.com/watch?v=...' }
			previewLabel={ field.label || __( 'Video preview', 'define-blocks' ) }
			resolvePreviewUrl={ getVideoEmbedUrl }
			renderPreview={ ( { previewUrl, label } ) => (
				<iframe src={ previewUrl } allowFullScreen title={ label } />
			) }
		/>
	);
}
