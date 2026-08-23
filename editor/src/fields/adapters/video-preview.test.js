import { getVideoEmbedUrl } from './video-preview';

describe( 'video preview adapter', () => {
	it( 'normalizes supported YouTube and Vimeo URLs', () => {
		expect( getVideoEmbedUrl( 'https://youtu.be/abc123' ) ).toBe(
			'https://www.youtube.com/embed/abc123'
		);
		expect( getVideoEmbedUrl( 'https://vimeo.com/12345' ) ).toBe(
			'https://player.vimeo.com/video/12345'
		);
	} );

	it( 'rejects unsupported URLs', () => {
		expect( getVideoEmbedUrl( 'https://example.com/video' ) ).toBeNull();
	} );
} );
