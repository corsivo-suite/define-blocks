import { __, sprintf } from '@wordpress/i18n';
import { isEmptyValue } from './values.js';
import { findSchemaField, walkSchema } from './schema';

function parsePattern( pattern ) {
	if ( pattern instanceof RegExp ) {
		return new RegExp( pattern.source, pattern.flags.replace( 'g', '' ) );
	}

	try {
		const match = pattern.match( /^\/(.+)\/([gimsuy]*)$/ );
		if ( match ) {
			return new RegExp( match[ 1 ], match[ 2 ].replace( 'g', '' ) );
		}
		return new RegExp( pattern );
	} catch {
		return null;
	}
}

function getValidationRules( fieldDef ) {
	const nestedRules = fieldDef.validate && typeof fieldDef.validate === 'object' && ! Array.isArray( fieldDef.validate )
		? fieldDef.validate
		: {};
	const rules = { ...nestedRules };

	[ 'required', 'pattern', 'minLength', 'maxLength', 'min', 'max', 'message' ].forEach( ( key ) => {
		if ( fieldDef[ key ] !== undefined ) {
			rules[ key ] = fieldDef[ key ];
		}
	} );

	return rules;
}

export function validateField( value, fieldDef ) {
	if ( ! fieldDef ) {
		return null;
	}

	const rules = getValidationRules( fieldDef );
	const msg = rules.message;

	if ( rules.required && isEmptyValue( value ) ) {
		return msg || __( 'This field is required', 'define-blocks' );
	}

	if ( Array.isArray( value ) ) {
		if ( rules.min !== undefined && value.length < rules.min ) {
			return msg || sprintf( __( 'Minimum %d items', 'define-blocks' ), rules.min );
		}
		if ( rules.max !== undefined && value.length > rules.max ) {
			return msg || sprintf( __( 'Maximum %d items', 'define-blocks' ), rules.max );
		}
		return null;
	}

	if ( ! rules.required && isEmptyValue( value ) ) {
		return null;
	}

	if ( typeof value === 'string' ) {
		const length = Array.from( value ).length;
		if ( rules.minLength && length < rules.minLength ) {
			return msg || sprintf( __( 'Minimum %d characters', 'define-blocks' ), rules.minLength );
		}
		if ( rules.maxLength && length > rules.maxLength ) {
			return msg || sprintf( __( 'Maximum %d characters', 'define-blocks' ), rules.maxLength );
		}
	}

	if ( rules.pattern && typeof value === 'string' ) {
		const regex = parsePattern( rules.pattern );
		if ( regex && ! regex.test( value ) ) {
			return msg || __( 'Invalid format', 'define-blocks' );
		}
	}

	const numVal = typeof value === 'number' ? value : parseFloat( value );
	if ( ! isNaN( numVal ) ) {
		if ( rules.min !== undefined && numVal < rules.min ) {
			return msg || sprintf( __( 'Minimum value is %s', 'define-blocks' ), rules.min );
		}
		if ( rules.max !== undefined && numVal > rules.max ) {
			return msg || sprintf( __( 'Maximum value is %s', 'define-blocks' ), rules.max );
		}
	}

	return null;
}

export function findFieldDef( schema, key ) {
	return findSchemaField( schema, key );
}

function hasValidationRules( fieldDef ) {
	const rules = getValidationRules( fieldDef );
	return rules.required || rules.pattern || rules.minLength ||
		rules.maxLength || rules.min !== undefined || rules.max !== undefined;
}

export function collectValidatableFields( schema ) {
	const fields = {};

	walkSchema( schema, ( def, key ) => {
		if ( hasValidationRules( def ) ) {
			fields[ key ] = def;
		}
	} );

	return fields;
}

function isVisible( fieldDef, conditionValues, conditionEvaluator ) {
	if ( fieldDef.visible === false ) {
		return false;
	}

	if ( ! conditionEvaluator ) {
		return true;
	}

	if ( fieldDef.condition && ! conditionEvaluator( fieldDef.condition, conditionValues ) ) {
		return false;
	}

	return ! ( fieldDef.conditionHide && conditionEvaluator( fieldDef.conditionHide, conditionValues ) );
}

function validateFields( fields, values, conditionValues, rootValues, basePath, errors, conditionEvaluator ) {
	for ( const [ key, fieldDef ] of Object.entries( fields || {} ) ) {
		if ( ! fieldDef || typeof fieldDef !== 'object' ) {
			continue;
		}

		if ( ! isVisible( fieldDef, conditionValues, conditionEvaluator ) ) {
			continue;
		}

		const fieldPath = basePath ? `${ basePath }.${ key }` : key;
		const isRepeater = fieldDef.type === 'repeater';
		const rawValue = values?.[ key ];
		const fieldValue = isRepeater && ! Array.isArray( rawValue ) ? [] : rawValue;

		if ( hasValidationRules( fieldDef ) ) {
			const error = validateField( fieldValue, fieldDef );
			if ( error ) {
				errors[ fieldPath ] = error;
			}
		}

		if ( isRepeater ) {
			fieldValue.forEach( ( item, index ) => {
				const itemValues = item && typeof item === 'object' && ! Array.isArray( item ) ? item : {};
				const itemConditionValues = { ...itemValues, $index: index, root: rootValues };
				validateFields(
					fieldDef.fields,
					itemValues,
					itemConditionValues,
					rootValues,
					`${ fieldPath }.${ index }`,
					errors,
					conditionEvaluator
				);
			} );
			continue;
		}

		if ( fieldDef.tabs ) {
			Object.values( fieldDef.tabs ).forEach( ( tab ) => {
				validateFields(
					tab.fields,
					values,
					conditionValues,
					rootValues,
					basePath,
					errors,
					conditionEvaluator
				);
			} );
		}

		if ( fieldDef.fields ) {
			validateFields(
				fieldDef.fields,
				values,
				conditionValues,
				rootValues,
				basePath,
				errors,
				conditionEvaluator
			);
		}
	}
}

export function validateAll( values, schema, conditionEvaluator ) {
	const errors = {};
	const rootValues = values && typeof values === 'object' && ! Array.isArray( values ) ? values : {};

	for ( const fields of [ schema.content?.fields, schema[ 'inspector-advanced' ]?.fields ] ) {
		validateFields( fields, rootValues, rootValues, rootValues, '', errors, conditionEvaluator );
	}

	for ( const scope of [ 'inspector', 'toolbar' ] ) {
		for ( const section of schema[ scope ] || [] ) {
			validateFields( section.fields, rootValues, rootValues, rootValues, '', errors, conditionEvaluator );
		}
	}

	return errors;
}
