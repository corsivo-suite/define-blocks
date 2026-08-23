const getYouTubeVideoId = ( parsedUrl, isShortUrl ) => {
	if ( isShortUrl ) {
		return parsedUrl.pathname.slice( 1 );
	}

	if ( parsedUrl.pathname.startsWith( '/embed/' ) ) {
		return parsedUrl.pathname.replace( '/embed/', '' );
	}

	if ( parsedUrl.pathname === '/watch' ) {
		return parsedUrl.searchParams.get( 'v' );
	}

	return null;
};

export function getVideoEmbedUrl( value ) {
	if ( ! value ) {
		return null;
	}

	try {
		const parsedUrl = new URL( value );
		const host = parsedUrl.hostname.replace( /^www\./, '' );
		const isYouTubeShort = host === 'youtu.be';
		const isYouTube = [
			'youtube.com',
			'm.youtube.com',
			'music.youtube.com',
			'youtube-nocookie.com',
		].includes( host );

		if ( isYouTube || isYouTubeShort ) {
			const videoId = getYouTubeVideoId( parsedUrl, isYouTubeShort );

			return videoId ? `https://www.youtube.com/embed/${ videoId }` : null;
		}

		if ( host === 'vimeo.com' || host === 'player.vimeo.com' ) {
			const segments = parsedUrl.pathname.split( '/' ).filter( Boolean );
			if ( host === 'player.vimeo.com' && segments[ 0 ] === 'video' ) {
				return value;
			}

			if ( /^\d+$/.test( segments[ 0 ] || '' ) ) {
				const embedUrl = `https://player.vimeo.com/video/${ segments[ 0 ] }`;
				return segments[ 1 ] ? `${ embedUrl }?h=${ segments[ 1 ] }` : embedUrl;
			}
		}
	} catch {
		return null;
	}

	return null;
}
