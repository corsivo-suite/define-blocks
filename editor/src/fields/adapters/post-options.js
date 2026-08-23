import apiFetch from '@wordpress/api-fetch';
import { addQueryArgs } from '@wordpress/url';

export function normalizePostOption( post ) {
	if ( ! post || typeof post !== 'object' || post.id === undefined ) {
		return null;
	}

	const id = String( post.id );
	const title = String( post.title ?? post.post_title ?? id );
	const permalink = String( post.permalink ?? post.url ?? post.link ?? '' );

	return {
		value: id,
		label: title,
		id: post.id,
		title,
		permalink,
		url: permalink,
		thumbnail: String( post.thumbnail || '' ),
	};
}

export async function loadPostOptions( postType, query, { signal } = {} ) {
	const posts = await apiFetch( {
		path: addQueryArgs( '/defb/v1/posts/search', {
			s: query,
			post_type: postType || 'post',
		} ),
		signal,
	} );

	return ( posts || [] ).map( normalizePostOption ).filter( Boolean );
}

export function toLegacyPosts( values, options = [], previousPosts = [] ) {
	const candidates = [
		...options,
		...( Array.isArray( previousPosts ) ? previousPosts : [] ),
	].map( normalizePostOption ).filter( Boolean );

	return ( Array.isArray( values ) ? values : [] ).map( ( value ) => {
		const option = candidates.find( ( candidate ) => candidate.value === String( value ) );
		return {
			id: option?.id ?? value,
			title: option?.title || String( value ),
			permalink: option?.permalink || '',
			thumbnail: option?.thumbnail || '',
		};
	} );
}
