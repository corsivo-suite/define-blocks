import { useCallback, useEffect, useMemo, useRef, useState } from '@wordpress/element';
import { useDispatch, useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';
import apiFetch from '@wordpress/api-fetch';
import { CreatableSortableMultiSelect } from '@corsivo-suite/wp-admin-ui/creatable-sortable-multi-select';
import { getSelectionI18n, getSortableI18n } from './control-i18n';
import {
	getLegacySelectionValues,
	normalizeLegacySelections,
	toLegacySelections,
} from './value-contracts';
import {
	buildTaxonomyRestPath,
	buildTaxonomySearchPath,
	chunkTermValues,
	mergeTermOptions,
	normalizeTermOption,
	normalizeTermOptions,
} from './taxonomy-options';

const SEARCH_RESULTS_PER_PAGE = 50;

export default function TaxonomyField( {
	id,
	field,
	value,
	onChange,
	onBlur,
	error,
} ) {
	const taxonomySlug = field.taxonomy || 'category';
	const { createErrorNotice } = useDispatch( 'core/notices' );
	const [ createdOptions, setCreatedOptions ] = useState( [] );
	const selectedOptions = useMemo(
		() => normalizeLegacySelections( value ),
		[ value ]
	);
	const selectedValues = useMemo(
		() => getLegacySelectionValues( value ),
		[ value ]
	);
	const taxonomy = useSelect(
		( select ) => select( 'core' ).getTaxonomy( taxonomySlug ),
		[ taxonomySlug ]
	);
	const resolvedRestBase = field.restBase || taxonomy?.rest_base;
	const resolvedRestNamespace = field.restNamespace || taxonomy?.rest_namespace || 'wp/v2';
	const restPath = resolvedRestBase
		? buildTaxonomyRestPath( resolvedRestNamespace, resolvedRestBase )
		: '';
	const requestContext = useMemo( () => ( { taxonomySlug, restPath } ), [ taxonomySlug, restPath ] );
	const contextRef = useRef( requestContext );
	const pendingRequests = useRef( new Set() );
	const selectionRef = useRef( selectedOptions );
	const savedValueRef = useRef( value );
	const onChangeRef = useRef( onChange );
	contextRef.current = requestContext;
	onChangeRef.current = onChange;
	if ( savedValueRef.current !== value ) {
		savedValueRef.current = value;
		selectionRef.current = selectedOptions;
	}
	useEffect( () => {
		setCreatedOptions( [] );
		const requests = pendingRequests.current;
		return () => {
			requests.forEach( ( controller ) => controller.abort() );
			requests.clear();
		};
	}, [ requestContext ] );
	const createFallbackOption = useCallback( ( selectedValue ) => {
		const normalizedValue = String( selectedValue );
		return selectedOptions.find( ( option ) => option.value === normalizedValue ) || {
			value: normalizedValue,
			label: normalizedValue,
		};
	}, [ selectedOptions ] );
	const canCreate = Boolean( field.allowCreate && restPath );
	const createLabel = field.createLabel || __( 'Create', 'define-blocks' );
	const controlI18n = getSelectionI18n(
		field.placeholder || __( 'Search terms…', 'define-blocks' ),
		1
	);
	const sortableI18n = getSortableI18n();
	const reportLoadError = useCallback( ( requestError ) => {
		createErrorNotice(
			requestError?.message || __( 'Could not load the terms.', 'define-blocks' ),
			{ type: 'snackbar' }
		);
	}, [ createErrorNotice ] );
	const loadOptions = useCallback( async ( query, { signal } ) => {
		const terms = await apiFetch( {
			path: buildTaxonomySearchPath( taxonomySlug, {
				search: query,
				perPage: SEARCH_RESULTS_PER_PAGE,
			} ),
			signal,
		} );

		return normalizeTermOptions( terms );
	}, [ taxonomySlug ] );
	const resolveValues = useCallback( async ( values, { signal } ) => {
		const batches = await Promise.all(
			chunkTermValues( values ).map( async ( include ) => apiFetch( {
				path: buildTaxonomySearchPath( taxonomySlug, {
					include,
					perPage: include.length,
				} ),
				signal,
			} ) )
		);

		return normalizeTermOptions( batches.flat() );
	}, [ taxonomySlug ] );

	const handleChange = useCallback( async ( nextValues, nextOptions, change ) => {
		if ( change?.type !== 'create' || ! canCreate ) {
			const nextSelection = toLegacySelections( nextValues, nextOptions, selectionRef.current );
			selectionRef.current = normalizeLegacySelections( nextSelection );
			onChangeRef.current( nextSelection );
			return;
		}

		const pendingOption = change.option;
		const controller = new AbortController();
		pendingRequests.current.add( controller );
		const isCurrent = () => ! controller.signal.aborted && contextRef.current === requestContext;
		const commitTerm = ( term ) => {
			const option = normalizeTermOption( term );
			if ( ! isCurrent() || ! option ) {
				return;
			}
			const resolvedOptions = mergeTermOptions( selectionRef.current, [ option ] );
			selectionRef.current = resolvedOptions;
			setCreatedOptions( ( currentOptions ) => mergeTermOptions( currentOptions, [ option ] ) );
			onChangeRef.current( toLegacySelections(
				resolvedOptions.map( ( selected ) => selected.value ),
				resolvedOptions
			) );
		};
		try {
			const createdTerm = await apiFetch( {
				path: restPath,
				method: 'POST',
				data: { name: pendingOption.label },
				signal: controller.signal,
			} );
			commitTerm( createdTerm );
		} catch ( requestError ) {
			if ( ! isCurrent() ) {
				return;
			}
			if ( requestError?.code === 'term_exists' && requestError?.data?.term_id ) {
				const existingTerm = {
					id: requestError.data.term_id,
					name: pendingOption.label,
				};
				commitTerm( existingTerm );
				return;
			}

			createErrorNotice(
				requestError?.message || __( 'Could not create the term.', 'define-blocks' ),
				{ type: 'snackbar' }
			);
		} finally {
			pendingRequests.current.delete( controller );
		}
	}, [ canCreate, createErrorNotice, restPath, requestContext ] );

	return (
		<CreatableSortableMultiSelect
			id={ id }
			label={ field.label }
			help={ field.description }
			error={ error }
			value={ selectedValues }
			onChange={ handleChange }
			onBlur={ onBlur }
			options={ createdOptions }
			loadOptions={ loadOptions }
			resolveValues={ resolveValues }
			createFallbackOption={ createFallbackOption }
			onLoadError={ reportLoadError }
			onResolveError={ reportLoadError }
			minQueryLength={ 1 }
			debounceMs={ 300 }
			allowCreate={ canCreate }
			allowReorder={ Boolean( field.draggable ) }
			createOption={ ( inputValue ) => ( {
				value: inputValue,
				label: inputValue,
				isCreated: true,
			} ) }
			renderOption={ ( option ) =>
				option.isCreated ? `${ createLabel }: ${ option.label }` : option.label
			}
			{ ...controlI18n }
			{ ...sortableI18n }
		/>
	);
}

TaxonomyField.handlesError = true;
