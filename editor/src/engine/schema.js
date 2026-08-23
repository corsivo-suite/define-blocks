export function walkFields( fields, visitor, options = {} ) {
	const includeRepeaterFields = !! options.includeRepeaterFields;

	for ( const [ key, field ] of Object.entries( fields || {} ) ) {
		if ( ! field || typeof field !== 'object' ) {
			continue;
		}

		if ( visitor( field, key ) === false ) {
			return false;
		}

		if ( field.tabs ) {
			for ( const tab of Object.values( field.tabs ) ) {
				if ( walkFields( tab.fields, visitor, options ) === false ) {
					return false;
				}
			}
		}

		if ( field.fields && ( includeRepeaterFields || field.type !== 'repeater' ) ) {
			if ( walkFields( field.fields, visitor, options ) === false ) {
				return false;
			}
		}
	}

	return true;
}

export function walkSchema( schema, visitor, options = {} ) {
	for ( const fields of [ schema.content?.fields, schema[ 'inspector-advanced' ]?.fields ] ) {
		if ( walkFields( fields, visitor, options ) === false ) {
			return false;
		}
	}

	for ( const scope of [ 'inspector', 'toolbar' ] ) {
		for ( const section of schema[ scope ] || [] ) {
			if ( walkFields( section.fields, visitor, options ) === false ) {
				return false;
			}
		}
	}

	return true;
}

export function findSchemaField( schema, fieldName ) {
	let found = null;

	walkSchema( schema, ( field, key ) => {
		if ( key === fieldName ) {
			found = field;
			return false;
		}
		return undefined;
	} );

	return found;
}

export function schemaHasFieldType( schema, ...types ) {
	let found = false;

	walkSchema(
		schema,
		( field ) => {
			if ( types.includes( field.type ) ) {
				found = true;
				return false;
			}
			return undefined;
		},
		{ includeRepeaterFields: true }
	);

	return found;
}
