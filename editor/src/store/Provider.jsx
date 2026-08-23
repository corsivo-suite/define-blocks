import { createContext, useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { useDispatch } from '@wordpress/data';
import { store as editorStore } from '@wordpress/editor';
import { doAction } from '@wordpress/hooks';
import { FieldSubscriptions } from './subscriptions';
import { validateAll } from '../engine/validation';
import { evaluateCondition } from '../engine/conditions';

export const BlockContext = createContext( null );

function normalizeValues( values ) {
	return values && typeof values === 'object' && ! Array.isArray( values )
		? values
		: {};
}

function mergeDefaultValues( defaults, values ) {
	return {
		...normalizeValues( defaults ),
		...normalizeValues( values ),
	};
}

export function BlockProvider( { blockName, clientId, attributes, setAttributes, schema, defaults, children } ) {
	const initialValues = mergeDefaultValues( defaults, attributes.values );
	const valuesRef = useRef( initialValues );
	const sourceValuesRef = useRef( attributes.values );
	const subs = useRef( new FieldSubscriptions() );
	const [ errors, setErrors ] = useState( () => validateAll( valuesRef.current, schema, evaluateCondition ) );
	const { lockPostSaving, unlockPostSaving } = useDispatch( editorStore );

	const revalidate = useCallback( ( values ) => {
		setErrors( validateAll( values, schema, evaluateCondition ) );
	}, [ schema ] );

	const flushToAttributes = useCallback( () => {
		const nextValues = { ...valuesRef.current };
		valuesRef.current = nextValues;
		sourceValuesRef.current = nextValues;
		setAttributes( { values: nextValues } );
	}, [ setAttributes ] );

	const saveField = useCallback( ( key, value ) => {
		valuesRef.current = { ...valuesRef.current, [ key ]: value };
		subs.current.notify( key, value );
		subs.current.notifyAny( valuesRef.current );
		flushToAttributes();
		doAction( `defb.change.${ blockName }.${ key }`, value, clientId );
		revalidate( valuesRef.current );
	}, [ blockName, clientId, flushToAttributes, revalidate ] );

	const getData = useCallback( () => valuesRef.current, [] );

	const setAllValues = useCallback( ( values ) => {
		valuesRef.current = mergeDefaultValues( defaults, values );
		subs.current.notifyAll( valuesRef.current );
		subs.current.notifyAny( valuesRef.current );
		flushToAttributes();
		revalidate( valuesRef.current );
	}, [ defaults, flushToAttributes, revalidate ] );

	const getFieldError = useCallback( ( key ) => {
		return errors[ key ] || null;
	}, [ errors ] );

	const validateFields = useCallback( () => {
		revalidate( valuesRef.current );
	}, [ revalidate ] );

	useEffect( () => {
		if ( attributes.values === sourceValuesRef.current ) {
			return;
		}
		sourceValuesRef.current = attributes.values;
		valuesRef.current = mergeDefaultValues( defaults, attributes.values );
		subs.current.notifyAll( valuesRef.current );
		subs.current.notifyAny( valuesRef.current );
		revalidate( valuesRef.current );
	}, [ attributes.values, defaults, revalidate ] );

	const subscribe = useCallback( ( path, cb ) => subs.current.subscribe( path, cb ), [] );
	const subscribeAny = useCallback( ( cb ) => subs.current.subscribeAny( cb ), [] );

	const hasErrors = Object.keys( errors ).length > 0;

	useEffect( () => {
		const lockName = `define-blocks-validation-${ clientId }`;
		if ( hasErrors ) {
			lockPostSaving( lockName );
		} else {
			unlockPostSaving( lockName );
		}

		return () => unlockPostSaving( lockName );
	}, [ clientId, hasErrors, lockPostSaving, unlockPostSaving ] );

	const ctx = useMemo( () => ( {
		blockName,
		clientId,
		schema,
		saveField,
		getData,
		setAllValues,
		subscribe,
		subscribeAny,
		getFieldError,
		validateFields,
		hasErrors,
	} ), [ blockName, clientId, schema, saveField, getData, setAllValues, subscribe, subscribeAny, getFieldError, validateFields, hasErrors ] );

	return (
		<BlockContext.Provider value={ ctx }>
			{ children }
		</BlockContext.Provider>
	);
}
