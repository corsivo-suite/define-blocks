import {
	createContext,
	useCallback,
	useEffect,
	useMemo,
	useRef,
} from '@wordpress/element';
import { doAction } from '@wordpress/hooks';
import { FieldSubscriptions } from './subscriptions';
import { validateAll } from '../engine/validation';
import { evaluateCondition } from '../engine/conditions';
import { hydrateSchemaValues, serializeValues } from '../engine/values';

export const BlockContext = createContext( null );
const emptyContext = {};

function normalizeValues( values ) {
	return values && typeof values === 'object' && ! Array.isArray( values )
		? values
		: {};
}

function mergeDefaultValues( defaults, values, schema ) {
	const current = normalizeValues( values );
	const missingDefaults = Object.fromEntries(
		Object.entries( normalizeValues( defaults ) ).filter(
			( [ key ] ) =>
				! Object.prototype.hasOwnProperty.call( current, key )
		)
	);
	return hydrateSchemaValues(
		schema,
		Object.keys( missingDefaults ).length
			? { ...missingDefaults, ...current }
			: current
	);
}

function sameErrors( first, second ) {
	const keys = Object.keys( first );
	return (
		keys.length === Object.keys( second ).length &&
		keys.every( ( key ) => first[ key ] === second[ key ] )
	);
}

export function BlockProvider( {
	blockName,
	clientId,
	attributes,
	setAttributes,
	schema,
	defaults,
	children,
	context: inheritedContext = emptyContext,
} ) {
	const inheritedContextKey = serializeValues( inheritedContext );
	const fieldContextRef = useRef( {
		key: inheritedContextKey,
		value: inheritedContext,
	} );
	if ( fieldContextRef.current.key !== inheritedContextKey ) {
		fieldContextRef.current = {
			key: inheritedContextKey,
			value: inheritedContext,
		};
	}
	const fieldContext = fieldContextRef.current.value;
	const setAttributesRef = useRef( setAttributes );
	setAttributesRef.current = setAttributes;
	const valuesRef = useRef( null );
	if ( valuesRef.current === null ) {
		valuesRef.current = mergeDefaultValues(
			defaults,
			attributes.values,
			schema
		);
	}
	const sourceValuesRef = useRef( attributes.values );
	const schemaRef = useRef( schema );
	const defaultsRef = useRef( defaults );
	const subscriptions = useRef( new FieldSubscriptions() );
	const errorSubscriptions = useRef( new FieldSubscriptions() );
	const errorSnapshots = useRef( new Map() );
	const errorsRef = useRef( null );
	if ( errorsRef.current === null ) {
		errorsRef.current = validateAll(
			valuesRef.current,
			schema,
			evaluateCondition
		);
	}

	const revalidate = useCallback(
		( values ) => {
			const nextErrors = validateAll( values, schema, evaluateCondition );
			if ( sameErrors( errorsRef.current, nextErrors ) ) {
				return;
			}
			errorsRef.current = nextErrors;
			errorSubscriptions.current.notifyAny( nextErrors );
		},
		[ schema ]
	);

	const flushToAttributes = useCallback( () => {
		const nextValues = valuesRef.current;
		sourceValuesRef.current = nextValues;
		setAttributesRef.current( { values: nextValues } );
	}, [] );

	const updateValues = useCallback(
		( values, changedField ) => {
			valuesRef.current = mergeDefaultValues( defaults, values, schema );
			if ( changedField ) {
				subscriptions.current.notify(
					changedField,
					valuesRef.current[ changedField ]
				);
			} else {
				subscriptions.current.notifyAll( valuesRef.current );
			}
			subscriptions.current.notifyAny( valuesRef.current );
			revalidate( valuesRef.current );
		},
		[ defaults, revalidate, schema ]
	);

	const saveField = useCallback(
		( key, value ) => {
			updateValues( { ...valuesRef.current, [ key ]: value }, key );
			flushToAttributes();
			doAction(
				`defb.change.${ blockName }.${ key }`,
				valuesRef.current[ key ],
				clientId
			);
		},
		[ blockName, clientId, flushToAttributes, updateValues ]
	);

	const getData = useCallback( () => valuesRef.current, [] );
	const setAllValues = useCallback(
		( values ) => {
			updateValues( values );
			flushToAttributes();
		},
		[ flushToAttributes, updateValues ]
	);
	const getFieldError = useCallback(
		( key ) => errorsRef.current[ key ] || null,
		[]
	);
	const getFieldErrors = useCallback( ( path ) => {
		const errors = Object.fromEntries(
			Object.entries( errorsRef.current ).filter(
				( [ key ] ) => key === path || key.startsWith( `${ path }.` )
			)
		);
		const previous = errorSnapshots.current.get( path );
		if ( previous && sameErrors( previous, errors ) ) {
			return previous;
		}
		errorSnapshots.current.set( path, errors );
		return errors;
	}, [] );
	const getValidationState = useCallback(
		() => Object.keys( errorsRef.current ).length > 0,
		[]
	);
	const validateFields = useCallback(
		() => revalidate( valuesRef.current ),
		[ revalidate ]
	);

	useEffect( () => {
		if (
			attributes.values !== sourceValuesRef.current ||
			schema !== schemaRef.current ||
			defaults !== defaultsRef.current
		) {
			sourceValuesRef.current = attributes.values;
			schemaRef.current = schema;
			defaultsRef.current = defaults;
			updateValues( attributes.values );
		}
		if ( valuesRef.current !== sourceValuesRef.current ) {
			flushToAttributes();
		}
	}, [
		attributes.values,
		defaults,
		flushToAttributes,
		schema,
		updateValues,
	] );

	const subscribe = useCallback(
		( path, callback ) => subscriptions.current.subscribe( path, callback ),
		[]
	);
	const subscribeAny = useCallback(
		( callback ) => subscriptions.current.subscribeAny( callback ),
		[]
	);
	const subscribeErrors = useCallback(
		( callback ) => errorSubscriptions.current.subscribeAny( callback ),
		[]
	);
	const context = useMemo(
		() => ( {
			context: fieldContext,
			blockName,
			clientId,
			schema,
			saveField,
			getData,
			setAllValues,
			subscribe,
			subscribeAny,
			subscribeErrors,
			getFieldError,
			getFieldErrors,
			getValidationState,
			validateFields,
		} ),
		[
			fieldContext,
			blockName,
			clientId,
			schema,
			saveField,
			getData,
			setAllValues,
			subscribe,
			subscribeAny,
			subscribeErrors,
			getFieldError,
			getFieldErrors,
			getValidationState,
			validateFields,
		]
	);

	return (
		<BlockContext.Provider value={ context }>
			{ children }
		</BlockContext.Provider>
	);
}
