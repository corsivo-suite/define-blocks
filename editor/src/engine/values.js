import { resolveType } from '../fields/aliases';
import { walkSchema } from './schema';

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

export function parseFieldValue( value, type ) {
	const resolved = resolveType( type );

	if ( resolved === 'checkbox' ) {
		return !! value;
	}

	if ( resolved === 'range' && typeof value === 'string' ) {
		return parseFloat( value ) || 0;
	}

	return value;
}
