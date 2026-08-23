export function buildTaxonomyRestPath( namespace, restBase ) {
	return `/${ String( namespace || 'wp/v2' ).replace( /^\/+|\/+$/g, '' ) }/${ String( restBase || '' ).replace( /^\/+|\/+$/g, '' ) }`;
}

export function normalizeTermOption( term ) {
	if ( ! term || typeof term !== 'object' || term.id === undefined ) {
		return null;
	}

	return {
		value: String( term.id ),
		label: String( term.name ?? term.id ),
	};
}

export function replacePendingTermOption( options, pendingValue, term ) {
	const replacement = normalizeTermOption( term );
	if ( ! replacement ) {
		return options;
	}

	const seenValues = new Set();
	return ( Array.isArray( options ) ? options : [] )
		.map( ( option ) => String( option?.value ) === String( pendingValue ) ? replacement : option )
		.filter( ( option ) => {
			const optionValue = String( option?.value );
			if ( seenValues.has( optionValue ) ) {
				return false;
			}
			seenValues.add( optionValue );
			return true;
		} );
}
