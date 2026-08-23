import { getTimeControlValue, restoreLegacyTimeValue } from './date-time-contract';

describe( 'DateTimeField legacy values', () => {
	it( 'passes local time values through unchanged', () => {
		expect( getTimeControlValue( '09:45:30' ) ).toBe( '09:45:30' );
		expect( restoreLegacyTimeValue( '09:45:30', '10:30:00' ) ).toBe( '10:30:00' );
	} );

	it( 'preserves the date portion of legacy ISO time values', () => {
		expect( getTimeControlValue( '2026-08-20T09:45:30' ) ).toBe( '09:45:30' );
		expect( restoreLegacyTimeValue( '2026-08-20T09:45:30', '10:30:00' ) ).toBe(
			'2026-08-20T10:30:00'
		);
	} );
} );
