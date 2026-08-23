import { useState } from '@wordpress/element';
import { InspectorControls } from '@wordpress/block-editor';
import { FocalPointPicker, PanelBody } from '@wordpress/components';
import { __, sprintf } from '@wordpress/i18n';
import { MediaControl } from '@corsivo-suite/wp-admin-ui/media-control';
import { renderWordPressMediaPicker } from './media-picker';
import { normalizeMediaValue } from './value-contracts';

export default function MediaField( { name, field, value, onChange, onBlur } ) {
	const media = value && typeof value === 'object' && Object.keys( value ).length
		? {
			...normalizeMediaValue( value ),
			...( value.focus ? { focus: value.focus } : {} ),
		}
		: null;
	const hasFocus = Boolean( field.focus );
	const focus = media?.focus || { x: 0.5, y: 0.5 };
	const [ liveFocus, setLiveFocus ] = useState( null );
	const displayFocus = liveFocus || focus;
	const aspectRatio = typeof field.focus === 'string' ? field.focus.replace( ':', ' / ' ) : null;

	const handleChange = ( selection ) => {
		if ( ! selection ) {
			onChange( {} );
			return;
		}

		const nextMedia = normalizeMediaValue( selection );
		if ( hasFocus ) {
			const isReplacement = media?.id && media.id !== nextMedia.id;
			nextMedia.focus = isReplacement ? { x: 0.5, y: 0.5 } : focus;
		}
		onChange( nextMedia );
	};

	return (
		<>
			{ hasFocus && media?.url && (
				<InspectorControls>
					<PanelBody title={ sprintf( __( '%s — Focus', 'define-blocks' ), field.label || name ) } initialOpen>
						<FocalPointPicker
							url={ media.url }
							value={ displayFocus }
							onDrag={ setLiveFocus }
							onChange={ ( nextFocus ) => {
								setLiveFocus( null );
								onChange( { ...media, focus: nextFocus } );
							} }
						/>
					</PanelBody>
				</InspectorControls>
			) }
			<MediaControl
				id={ name }
				label={ field.label }
				help={ field.description }
				value={ media }
				onChange={ handleChange }
				onBlur={ onBlur }
				renderMediaPicker={ renderWordPressMediaPicker }
				allowedTypes={ field.allowedTypes || [ 'image' ] }
				selectLabel={ field.buttonLabel || __( 'Select Image', 'define-blocks' ) }
				replaceLabel={ __( 'Replace', 'define-blocks' ) }
				removeLabel={ __( 'Remove', 'define-blocks' ) }
				renderPreview={ ( { url } ) => (
					<img
						src={ url }
						alt=""
						style={ hasFocus ? {
							objectPosition: `${ displayFocus.x * 100 }% ${ displayFocus.y * 100 }%`,
							...( aspectRatio ? { aspectRatio } : {} ),
						} : undefined }
					/>
				) }
			/>
		</>
	);
}
