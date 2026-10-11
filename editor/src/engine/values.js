import { resolveType } from '../fields/aliases';
import { walkSchema } from './schema';

const choiceTypes = new Set( [
	'select',
	'autocomplete',
	'toolbar-select',
	'toolbar-autocomplete',
] );
const textTypes = new Set( [
	'text',
	'text-with-parser',
	'textarea',
	'richtext',
	'color',
	'url',
	'video',
	'date',
	'time',
	'datetime',
	'toolbar-input',
] );

export function getFieldValueKind( field ) {
	const type = resolveType( field.type );
	if (
		type === 'number' ||
		type === 'range' ||
		field.originalType === 'number'
	) {
		return 'number';
	}
	if ( type === 'checkbox' || type === 'toolbar-toggle' ) {
		return 'boolean';
	}
	if ( choiceTypes.has( type ) ) {
		return 'choice';
	}
	return textTypes.has( type ) ? 'text' : type;
}

export function normalizeBooleanValue( value ) {
	if ( [ true, 1, '1', 'true' ].includes( value ) ) {
		return true;
	}
	if ( [ false, 0, '0', 'false', '' ].includes( value ) ) {
		return false;
	}
	return value;
}

export function isRepeaterItem( item ) {
	return (
		!! item &&
		typeof item === 'object' &&
		( ! Array.isArray( item ) || item.length === 0 )
	);
}

export function isRepeaterValue( value ) {
	return Array.isArray( value ) && value.every( isRepeaterItem );
}

export function isValidFieldValue( value, field ) {
	if ( value === undefined || value === null ) {
		return true;
	}
	const kind = getFieldValueKind( field );
	if ( kind === 'repeater' ) {
		return isRepeaterValue( value );
	}
	if ( kind === 'number' ) {
		return (
			value === '' || Number.isFinite( normalizeNumericValue( value ) )
		);
	}
	if ( kind === 'boolean' ) {
		return typeof normalizeBooleanValue( value ) === 'boolean';
	}
	if ( kind === 'text' ) {
		return typeof value === 'string';
	}
	if ( kind === 'choice' ) {
		return (
			typeof value === 'string' ||
			( typeof value === 'number' && Number.isFinite( value ) )
		);
	}
	return true;
}

export function isEmptyValue( value ) {
	if ( value === null || value === undefined || value === '' ) {
		return true;
	}
	if ( Array.isArray( value ) ) {
		return value.length === 0;
	}
	if ( typeof value === 'object' ) {
		return Object.values( value ).every(
			( v ) => v === '' || v === null || v === undefined || v === false
		);
	}
	return false;
}

export function collectDefaults( schema ) {
	const defaults = {};

	walkSchema( schema, ( field, key ) => {
		if ( field.default !== undefined ) {
			defaults[ key ] = field.default;
		}
	} );

	return defaults;
}

export function buildEmpty( field ) {
	if ( field.default !== undefined ) {
		return cloneValue( field.default );
	}

	const type = resolveType( field.type );

	switch ( type ) {
		case 'repeater':
			return [];
		case 'gallery':
			return [];
		case 'media':
		case 'file':
			return {};
		case 'link':
			return { url: '', title: '', opensInNewTab: false };
		case 'checkbox':
			return field.default ?? false;
		case 'range':
			return field.default ?? field.min ?? 0;
		case 'chips':
		case 'multi-select':
		case 'multi-autocomplete':
			return [];
		case 'color':
			return '';
		default:
			return field.default ?? '';
	}
}

function cloneValue( value ) {
	if ( Array.isArray( value ) ) {
		return value.map( cloneValue );
	}
	if ( value && typeof value === 'object' ) {
		return Object.fromEntries(
			Object.entries( value ).map( ( [ key, nestedValue ] ) => [
				key,
				cloneValue( nestedValue ),
			] )
		);
	}
	return value;
}

export function normalizeNumericValue( value ) {
	if (
		typeof value !== 'string' ||
		! /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test( value.trim() )
	) {
		return value;
	}
	const number = Number( value );
	return Number.isFinite( number ) ? number : value;
}

export function hydrateFieldValue( field, value, options = {} ) {
	const kind = getFieldValueKind( field );
	if ( kind === 'number' ) {
		return normalizeNumericValue( value );
	}
	if ( kind === 'boolean' ) {
		return normalizeBooleanValue( value );
	}
	if (
		kind === 'choice' &&
		typeof value === 'number' &&
		Number.isFinite( value )
	) {
		return String( value );
	}
	if ( kind !== 'repeater' || ! Array.isArray( value ) ) {
		return value;
	}
	const items = value.map( ( item ) =>
		isRepeaterItem( item )
			? hydrateValues( field.fields, item, options )
			: item
	);
	return items.some( ( item, index ) => item !== value[ index ] )
		? items
		: value;
}

export function hydrateValues( fields, values, options = {} ) {
	let hydrated =
		values && typeof values === 'object' && ! Array.isArray( values )
			? values
			: {};
	for ( const [ key, field ] of Object.entries( fields || {} ) ) {
		if ( ! field || typeof field !== 'object' ) {
			continue;
		}
		const type = resolveType( field.type );
		if ( type !== 'group' && type !== 'tabpanels' ) {
			const hasValue = Object.prototype.hasOwnProperty.call(
				hydrated,
				key
			);
			if (
				hasValue ||
				field.default !== undefined ||
				options.populateEmpty
			) {
				const nextValue = hydrateFieldValue(
					field,
					hasValue ? hydrated[ key ] : buildEmpty( field ),
					options
				);
				if ( ! hasValue || nextValue !== hydrated[ key ] ) {
					hydrated = { ...hydrated, [ key ]: nextValue };
				}
			}
		}
		if ( type !== 'repeater' && field.fields ) {
			hydrated = hydrateValues( field.fields, hydrated, options );
		}
		for ( const tab of Object.values( field.tabs || {} ) ) {
			hydrated = hydrateValues( tab.fields, hydrated, options );
		}
	}
	return hydrated;
}

export function hydrateSchemaValues( schema, values ) {
	let hydrated = values;
	for ( const fields of [
		schema.content?.fields,
		schema[ 'inspector-advanced' ]?.fields,
	] ) {
		hydrated = hydrateValues( fields, hydrated );
	}
	for ( const scope of [ 'inspector', 'toolbar' ] ) {
		for ( const section of schema[ scope ] || [] ) {
			hydrated = hydrateValues( section.fields, hydrated );
		}
	}
	return hydrated;
}

export function serializeValues( value ) {
	const sortProperties = ( nestedValue ) => {
		if ( Array.isArray( nestedValue ) ) {
			return nestedValue.map( sortProperties );
		}
		if ( nestedValue && typeof nestedValue === 'object' ) {
			return Object.fromEntries(
				Object.keys( nestedValue )
					.sort()
					.map( ( key ) => [
						key,
						sortProperties( nestedValue[ key ] ),
					] )
			);
		}
		return nestedValue;
	};
	return JSON.stringify( sortProperties( value ) );
}

export function parseFieldValue( value, type ) {
	const resolved = resolveType( type );

	if ( resolved === 'checkbox' ) {
		return normalizeBooleanValue( value );
	}

	if ( resolved === 'range' && typeof value === 'string' ) {
		return parseFloat( value ) || 0;
	}

	return value;
}
