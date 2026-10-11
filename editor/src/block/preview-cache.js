import { serializeValues } from '../engine/values';

const previews = new Map();
const lifetime = 15000;
const maximumEntries = 30;

export function getPreviewKey( request ) {
	return serializeValues( request );
}

export function getCachedPreview( key ) {
	const preview = previews.get( key );
	if ( ! preview || Date.now() - preview.createdAt > lifetime ) {
		previews.delete( key );
		return undefined;
	}
	previews.delete( key );
	previews.set( key, preview );
	return preview.html;
}

export function cachePreview( key, html ) {
	previews.delete( key );
	previews.set( key, { html, createdAt: Date.now() } );
	if ( previews.size > maximumEntries ) {
		previews.delete( previews.keys().next().value );
	}
}
