import {
	useContext,
	useState,
	useEffect,
	useCallback,
	useSyncExternalStore,
} from '@wordpress/element';
import { BlockContext } from './Provider';

export function useBlockContext() {
	const ctx = useContext( BlockContext );
	if ( ! ctx ) {
		throw new Error(
			'useBlockContext must be used within a BlockProvider'
		);
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

	const onChange = useCallback(
		( newValue ) => {
			saveField( key, newValue );
		},
		[ key, saveField ]
	);

	return [ value, onChange ];
}

export function useFieldError( key ) {
	const { subscribeErrors, getFieldError } = useBlockContext();
	const getSnapshot = useCallback(
		() => getFieldError( key ),
		[ getFieldError, key ]
	);
	return useSyncExternalStore( subscribeErrors, getSnapshot, getSnapshot );
}

export function useFieldErrors( path ) {
	const { subscribeErrors, getFieldErrors } = useBlockContext();
	const getSnapshot = useCallback(
		() => getFieldErrors( path ),
		[ getFieldErrors, path ]
	);
	return useSyncExternalStore( subscribeErrors, getSnapshot, getSnapshot );
}

export function useValidationState() {
	const { subscribeErrors, getValidationState } = useBlockContext();
	return useSyncExternalStore(
		subscribeErrors,
		getValidationState,
		getValidationState
	);
}
