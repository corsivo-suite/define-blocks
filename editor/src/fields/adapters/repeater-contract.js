export function normalizeRepeaterLimit( value, fallback ) {
	if ( value === undefined || value === null || value === '' ) {
		return fallback;
	}

	const limit = Number( value );
	return Number.isFinite( limit ) ? Math.max( 0, Math.floor( limit ) ) : fallback;
}

export function normalizeRepeaterItems( items, createId ) {
	const knownIds = new Set();
	return ( Array.isArray( items ) ? items : [] ).map( ( item ) => {
		const normalizedItem = item && typeof item === 'object' && ! Array.isArray( item )
			? item
			: {};
		const itemId = normalizedItem._defb_id;
		const hasStableId = itemId !== undefined && itemId !== null && String( itemId ) !== '';

		if ( hasStableId && ! knownIds.has( itemId ) ) {
			knownIds.add( itemId );
			return normalizedItem;
		}

		const nextId = createId();
		knownIds.add( nextId );
		return { ...normalizedItem, _defb_id: nextId };
	} );
}

export function createRepeaterItem( fields, createId, buildValue ) {
	const item = { _defb_id: createId() };
	Object.entries( fields || {} ).forEach( ( [ key, field ] ) => {
		item[ key ] = buildValue( field );
	} );
	return item;
}

export function duplicateRepeaterItem( item, createId ) {
	return { ...item, _defb_id: createId() };
}

export function repeaterFieldsNeedRootValues( fields ) {
	return Object.values( fields || {} ).some( ( field ) => {
		const conditions = [ field?.condition, field?.conditionHide ].filter( Boolean );
		if ( conditions.some( ( condition ) => JSON.stringify( condition ).includes( 'root' ) ) ) {
			return true;
		}

		if ( field?.fields && repeaterFieldsNeedRootValues( field.fields ) ) {
			return true;
		}

		return Object.values( field?.tabs || {} ).some(
			( tab ) => repeaterFieldsNeedRootValues( tab.fields )
		);
	} );
}
