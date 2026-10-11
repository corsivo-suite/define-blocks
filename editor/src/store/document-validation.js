import { evaluateCondition } from '../engine/conditions';
import { hydrateSchemaValues } from '../engine/values';
import { validateAll } from '../engine/validation';

export function documentHasValidationErrors( blocks, getDefinition ) {
	return ( blocks || [] ).some( ( block ) => {
		const definition = getDefinition( block.name );
		if ( definition?._schema ) {
			const values = hydrateSchemaValues( definition._schema, {
				...definition._defaults,
				...block.attributes?.values,
			} );
			if (
				Object.keys(
					validateAll( values, definition._schema, evaluateCondition )
				).length
			) {
				return true;
			}
		}
		return documentHasValidationErrors( block.innerBlocks, getDefinition );
	} );
}

export function observeDocumentValidation( {
	getBlocks,
	getDefinition,
	subscribe,
	lockSaving,
	unlockSaving,
} ) {
	let previousBlocks;
	let locked = false;
	const update = () => {
		const blocks = getBlocks();
		if ( blocks === previousBlocks ) {
			return;
		}
		previousBlocks = blocks;
		const nextLocked = documentHasValidationErrors( blocks, getDefinition );
		if ( locked === nextLocked ) {
			return;
		}
		locked = nextLocked;
		if ( locked ) {
			lockSaving();
		} else {
			unlockSaving();
		}
	};
	const unsubscribe = subscribe( update );
	update();
	return () => {
		unsubscribe();
		if ( locked ) {
			unlockSaving();
		}
	};
}
