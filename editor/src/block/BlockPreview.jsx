import { useState, useEffect } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { serialize } from '@wordpress/blocks';
import { Spinner, Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { useBlockContext } from '../store/hooks';
import { cachePreview, getCachedPreview, getPreviewKey } from './preview-cache';

export default function BlockPreview( {
	blockName,
	attributes,
	context = {},
	onRestore,
} ) {
	const { clientId } = useBlockContext();
	const currentPostId = useSelect(
		( select ) => select( 'core/editor' ).getCurrentPostId(),
		[]
	);
	const content = useSelect(
		( select ) =>
			serialize( select( 'core/block-editor' ).getBlocks( clientId ) ),
		[ clientId ]
	);
	const [ html, setHtml ] = useState( '' );
	const [ error, setError ] = useState( '' );
	const [ loading, setLoading ] = useState( true );
	const previewAttributes = Object.fromEntries(
		Object.entries( attributes || {} ).filter(
			( [ key ] ) => key !== 'isPreview' && key !== 'collapsed'
		)
	);
	const requestKey = getPreviewKey( {
		blockName,
		post_id: context.postId ?? currentPostId,
		attributes: previewAttributes,
		content,
		context,
	} );

	useEffect( () => {
		const controller = new AbortController();
		setError( '' );
		const cached = getCachedPreview( requestKey );
		if ( cached !== undefined ) {
			setHtml( cached );
			setLoading( false );
			return () => controller.abort();
		}
		setLoading( true );

		const timeout = setTimeout(
			() =>
				apiFetch( {
					path: '/defb/v1/render',
					method: 'POST',
					data: JSON.parse( requestKey ),
					signal: controller.signal,
				} )
					.then( ( res ) => {
						if ( ! controller.signal.aborted ) {
							const nextHtml = typeof res === 'string' ? res : '';
							cachePreview( requestKey, nextHtml );
							setHtml( nextHtml );
							setLoading( false );
						}
					} )
					.catch( ( err ) => {
						if ( controller.signal.aborted ) {
							return;
						}
						setError(
							err?.message ||
								__(
									'The preview request failed.',
									'define-blocks'
								)
						);
						setLoading( false );
					} ),
			250
		);

		return () => {
			clearTimeout( timeout );
			controller.abort();
		};
	}, [ requestKey ] );

	const isEmpty =
		! loading &&
		( ! html.trim() || /^<(p|div)>\s*<\/\1>$/.test( html.trim() ) );

	if ( loading && ! html ) {
		return (
			<div className="defb-preview__loading">
				<Spinner />
			</div>
		);
	}

	if ( error && ! html ) {
		return (
			<div className="defb-preview__empty">
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
				<Button variant="secondary" onClick={ onRestore }>
					{ __( 'Back to editor', 'define-blocks' ) }
				</Button>
			</div>
		);
	}

	if ( isEmpty ) {
		return (
			<div className="defb-preview__empty">
				<p>
					{ __(
						'This block returned empty output.',
						'define-blocks'
					) }
				</p>
				<Button variant="secondary" onClick={ onRestore }>
					{ __( 'Back to editor', 'define-blocks' ) }
				</Button>
			</div>
		);
	}

	return (
		<div className="defb-preview" aria-busy={ loading }>
			{ error && (
				<Notice status="error" isDismissible={ false }>
					{ error }
				</Notice>
			) }
			<div
				className="defb-preview__html"
				dangerouslySetInnerHTML={ { __html: html } }
			/>
		</div>
	);
}
