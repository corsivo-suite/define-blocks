export function buildTaxonomyRestPath( namespace, restBase ) {
	return `/${ String( namespace || 'wp/v2' ).replace( /^\/+|\/+$/g, '' ) }/${ String( restBase || '' ).replace( /^\/+|\/+$/g, '' ) }`;
}

export function buildTaxonomySearchPath(
	taxonomy,
	{ search = '', include = [], page = 1, perPage = 20 } = {}
) {
	const query = Object.entries( {
		taxonomy,
		search: include.length ? undefined : search,
		include: include.length ? include.join( ',' ) : undefined,
		page,
		per_page: perPage,
	} )
		.filter( ( [ , value ] ) => value !== undefined && value !== '' )
		.map( ( [ key, value ] ) => `${ encodeURIComponent( key ) }=${ encodeURIComponent( value ) }` )
		.join( '&' );

	return `/defb/v1/taxonomy/terms?${ query }`;
}

export function chunkTermValues( values, size = 100 ) {
	const normalizedValues = Array.from( new Set(
		( Array.isArray( values ) ? values : [] )
			.map( ( value ) => String( value ) )
			.filter( Boolean )
	) );
	const chunks = [];

	for ( let index = 0; index < normalizedValues.length; index += size ) {
		chunks.push( normalizedValues.slice( index, index + size ) );
	}

	return chunks;
}

export function normalizeTermOption( term ) {
	if ( ! term || typeof term !== 'object' || term.id === undefined ) {
		return null;
	}

	return {
		value: String( term.id ),
		label: String( term.path || term.name || term.id ),
	};
}

export function normalizeTermOptions( terms ) {
	return ( Array.isArray( terms ) ? terms : [] )
		.map( normalizeTermOption )
		.filter( Boolean );
}

export function mergeTermOptions( ...optionSets ) {
	const options = [];
	const seenValues = new Set();

	optionSets.flat().forEach( ( option ) => {
		if ( ! option || option.value === undefined ) {
			return;
		}
		const optionValue = String( option.value );
		if ( seenValues.has( optionValue ) ) {
			return;
		}
		seenValues.add( optionValue );
		options.push( { ...option, value: optionValue } );
	} );

	return options;
}

export function replacePendingTermOption( options, pendingValue, term ) {
	const replacement = normalizeTermOption( term );
	if ( ! replacement ) {
		return options;
	}

	return mergeTermOptions(
		( Array.isArray( options ) ? options : [] ).map( ( option ) =>
			String( option?.value ) === String( pendingValue ) ? replacement : option
		)
	);
}
