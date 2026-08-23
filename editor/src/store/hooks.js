import { useContext, useState, useEffect, useCallback } from '@wordpress/element';
import { BlockContext } from './Provider';

export function useBlockContext() {
	const ctx = useContext( BlockContext );
	if ( ! ctx ) {
		throw new Error( 'useBlockContext must be used within a BlockProvider' );
	}
	return ctx;
}

export function useFieldValue( key ) {
	const { getData, saveField, subscribe } = useBlockContext();
	const [ value, setValue ] = useState( () => getData()[ key ] );

	useEffect( () => {
		setValue( getData()[ key ] );
		return subscribe( key, ( newValue ) => {
			setValue( newValue );
		} );
	}, [ key, subscribe, getData ] );

	const onChange = useCallback( ( newValue ) => {
		saveField( key, newValue );
	}, [ key, saveField ] );

	return [ value, onChange ];
}
