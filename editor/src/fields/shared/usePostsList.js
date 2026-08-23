import { useState, useEffect } from '@wordpress/element';
import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

const postsListCache = new Map();

function fetchPostsList( postType ) {
	if ( ! postsListCache.has( postType ) ) {
		const request = apiFetch( {
			path: addQueryArgs( '/defb/v1/posts/list', { post_type: postType } ),
		} ).then( ( results ) => results || [] ).catch( () => {
			postsListCache.delete( postType );
			return [];
		} );
		postsListCache.set( postType, request );
	}
	return postsListCache.get( postType );
}

export function usePostsList( postType ) {
	const [ posts, setPosts ] = useState( null );
	const [ loading, setLoading ] = useState( !! postType );

	useEffect( () => {
		if ( ! postType ) {
			setPosts( null );
			setLoading( false );
			return;
		}
		let cancelled = false;
		setLoading( true );
		fetchPostsList( postType ).then( ( results ) => {
			if ( cancelled ) {
				return;
			}
			setPosts( results );
			setLoading( false );
		} );
		return () => {
			cancelled = true;
		};
	}, [ postType ] );

	return { posts, loading };
}
