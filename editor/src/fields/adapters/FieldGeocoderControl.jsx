import { useCallback, useEffect, useId, useMemo, useRef, useState } from '@wordpress/element';
import { Button, Notice, TextControl } from '@wordpress/components';
import { __ } from '@wordpress/i18n';
import { GeocoderControl } from '@corsivo-suite/wp-admin-maps';

export default function FieldGeocoderControl( props ) {
	const { geocoder, query, onQueryChange, onChange, labels = {}, id, label, help } = props;
	const generatedId = useId();
	const controlId = id || `defb-geocoder-${ generatedId }`;
	const [ results, setResults ] = useState( null );
	const [ searching, setSearching ] = useState( false );
	const [ searchError, setSearchError ] = useState( '' );
	const requestRef = useRef( null );
	const reverseGeocoder = useMemo( () => ( { reverse: geocoder?.reverse } ), [ geocoder ] );

	useEffect( () => {
		setResults( null );
		setSearchError( '' );
		setSearching( false );
		return () => requestRef.current?.abort();
	}, [ query, geocoder ] );

	const search = useCallback( async () => {
		if ( ! String( query || '' ).trim() ) {
			return;
		}
		requestRef.current?.abort();
		const controller = new AbortController();
		requestRef.current = controller;
		setSearching( true );
		setSearchError( '' );
		setResults( null );
		try {
			const options = await geocoder.search( query, { signal: controller.signal } );
			if ( ! controller.signal.aborted ) {
				setResults( options );
			}
		} catch ( error ) {
			if ( ! controller.signal.aborted ) {
				setSearchError( labels.searchError || error.message );
			}
		} finally {
			if ( ! controller.signal.aborted ) {
				setSearching( false );
			}
		}
	}, [ geocoder, query, labels.searchError ] );

	if ( ! geocoder?.requiresSubmit ) {
		return <GeocoderControl { ...props } id={ controlId } />;
	}

	return (
		<>
			<TextControl
				id={ `${ controlId }-search` }
				label={ label || __( 'Search address', 'define-blocks' ) }
				help={ help }
				placeholder={ labels.searchPlaceholder }
				value={ query || '' }
				onChange={ ( nextQuery ) => {
					requestRef.current?.abort();
					onQueryChange( nextQuery );
				} }
				onKeyDown={ ( event ) => {
					if ( event.key === 'Enter' ) {
						event.preventDefault();
						search();
					}
				} }
			/>
			<Button variant="secondary" onClick={ search } isBusy={ searching } disabled={ searching || ! String( query || '' ).trim() }>
				{ __( 'Search', 'define-blocks' ) }
			</Button>
			<div aria-live="polite" aria-busy={ searching }>
				{ results?.length === 0 && <p>{ labels.searchEmpty }</p> }
				{ !! results?.length && <ul>
					{ results.map( ( option ) => <li key={ option.value }>
						<Button variant="link" onClick={ () => {
							setResults( null );
							onChange( option.location, { type: 'select', query: option.label } );
						} }>{ option.label }</Button>
					</li> ) }
				</ul> }
			</div>
			{ searchError && <Notice status="error" isDismissible={ false }>{ searchError }</Notice> }
			<GeocoderControl { ...props } id={ `${ controlId }-location` } label={ undefined } help={ undefined } geocoder={ reverseGeocoder } />
		</>
	);
}
