import { cachePreview, getCachedPreview, getPreviewKey } from './preview-cache';

describe( 'preview cache', () => {
	it( 'builds stable keys from reordered object properties', () => {
		expect(
			getPreviewKey( {
				context: { b: 2, a: 1 },
				attributes: { values: { title: 'A' } },
			} )
		).toBe(
			getPreviewKey( {
				attributes: { values: { title: 'A' } },
				context: { a: 1, b: 2 },
			} )
		);
	} );

	it( 'expires stale HTML and bounds the cache size', () => {
		const now = jest.spyOn( Date, 'now' ).mockReturnValue( 0 );
		cachePreview( 'expiry', '<p>Old</p>' );
		expect( getCachedPreview( 'expiry' ) ).toBe( '<p>Old</p>' );
		now.mockReturnValue( 15001 );
		expect( getCachedPreview( 'expiry' ) ).toBeUndefined();
		for ( let index = 0; index < 31; index++ ) {
			cachePreview( `entry-${ index }`, `HTML ${ index }` );
		}
		expect( getCachedPreview( 'entry-0' ) ).toBeUndefined();
		expect( getCachedPreview( 'entry-30' ) ).toBe( 'HTML 30' );
		now.mockRestore();
	} );
} );
