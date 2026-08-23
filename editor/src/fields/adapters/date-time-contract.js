export function getTimeControlValue( value ) {
	if ( typeof value !== 'string' ) {
		return '';
	}

	const match = value.match( /(?:T|^)(\d{2}:\d{2}(?::\d{2})?)/ );
	return match ? match[ 1 ] : value;
}

export function restoreLegacyTimeValue( previousValue, nextValue ) {
	if ( ! nextValue || typeof previousValue !== 'string' || ! previousValue.includes( 'T' ) ) {
		return nextValue;
	}

	return previousValue.replace( /T\d{2}:\d{2}(?::\d{2})?/, `T${ nextValue }` );
}
