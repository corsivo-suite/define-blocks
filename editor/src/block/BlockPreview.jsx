import { useState, useEffect, useRef } from '@wordpress/element';
import { useSelect } from '@wordpress/data';
import { serialize } from '@wordpress/blocks';
import { Spinner, Button, Notice } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { useBlockContext } from '../store/hooks';

export default function BlockPreview( { blockName, attributes, onRestore } ) {
	const { clientId } = useBlockContext();
	const postId = useSelect(
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
	const abortRef = useRef( null );
	const attributesKey = JSON.stringify( attributes || {} );

	useEffect( () => {
		abortRef.current?.abort();
		const controller = new AbortController();
		abortRef.current = controller;
		setLoading( true );
		setError( '' );

		apiFetch( {
			path: '/defb/v1/render',
			method: 'POST',
			data: {
				blockName,
				post_id: postId,
				attributes: JSON.parse( attributesKey ),
				content,
			},
			signal: controller.signal,
		} )
			.then( ( res ) => {
				if ( ! controller.signal.aborted ) {
					setHtml( typeof res === 'string' ? res : '' );
					setLoading( false );
				}
			} )
			.catch( ( err ) => {
				if ( controller.signal.aborted ) {
					return;
				}
				setHtml( '' );
				setError(
					err?.message ||
						__( 'The preview request failed.', 'define-blocks' )
				);
				setLoading( false );
			} );

		return () => controller.abort();
	}, [ blockName, postId, attributesKey, content ] );

	const isEmpty =
		! loading &&
		( ! html.trim() || /^<(p|div)>\s*<\/\1>$/.test( html.trim() ) );

	if ( loading ) {
		return (
			<div className="defb-preview__loading">
				<Spinner />
			</div>
		);
	}

	if ( error ) {
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
		<div
			className="defb-preview defb-preview__html"
			dangerouslySetInnerHTML={ { __html: html } }
		/>
	);
}
