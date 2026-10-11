import { memo, useCallback, useEffect, useId, useState } from '@wordpress/element';
import { useFieldValue, useFieldError, useBlockContext } from '../store/hooks';
import { resolveType } from './aliases';
import { getFieldComponent } from './registry';
import { evaluateCondition } from '../engine/conditions';

const TOOLBAR_TYPE_MAP = {
	select: 'toolbar-select',
	checkbox: 'toolbar-toggle',
	toggle: 'toolbar-toggle',
	text: 'toolbar-input',
	number: 'toolbar-input',
	autocomplete: 'toolbar-autocomplete',
};

function Dispatcher( { name, field, scope } ) {
	const generatedId = useId();
	const id = `defb-field-${ generatedId }`;
	const [ value, onChange ] = useFieldValue( name );
	const fieldError = useFieldError( name );
	const { getData, subscribeAny, validateFields, context } = useBlockContext();

	const hasCondition = !! ( field.condition || field.conditionHide );

	const computeVisible = useCallback( () => {
		if ( field.visible === false ) {
			return false;
		}
		if ( ! hasCondition ) {
			return true;
		}
		const values = getData();
		if ( field.condition && ! evaluateCondition( field.condition, values ) ) {
			return false;
		}
		if ( field.conditionHide && evaluateCondition( field.conditionHide, values ) ) {
			return false;
		}
		return true;
	}, [ field, hasCondition, getData ] );

	const [ visible, setVisible ] = useState( computeVisible );

	useEffect( () => {
		if ( ! hasCondition ) {
			return undefined;
		}
		return subscribeAny( () => {
			const next = computeVisible();
			setVisible( ( prev ) => ( prev === next ? prev : next ) );
		} );
	}, [ hasCondition, subscribeAny, computeVisible ] );

	const isToolbar = scope === 'toolbar';

	if ( ! visible ) {
		return null;
	}

	const type = resolveType( field.type );
	const originalType = field.originalType || type;
	const resolvedType = isToolbar && TOOLBAR_TYPE_MAP[ type ] ? TOOLBAR_TYPE_MAP[ type ] : type;
	const Component = getFieldComponent( resolvedType );

	const error = isToolbar ? null : fieldError;

	const fieldProps = { id, name, field, type, value, onChange, onBlur: validateFields, error, context };
	if ( isToolbar && originalType === 'number' ) {
		fieldProps.field = { ...field, _toolbarType: 'number' };
	}

	if ( isToolbar ) {
		return <Component { ...fieldProps } />;
	}

	if ( type === 'hidden' ) {
		return <Component { ...fieldProps } />;
	}

	const style = {};
	if ( field.width ) {
		style.width = `${ field.width }%`;
	}
	if ( field.style ) {
		Object.assign( style, field.style );
	}

	const className = `defb-field${ error ? ' defb-field--error' : '' }`;

	return (
		<div className={ className } style={ style } data-field-type={ type } data-field-name={ name }>
			<Component { ...fieldProps } />
			{ error && ! Component.handlesError && <p className="defb-field__error">{ error }</p> }
		</div>
	);
}

export default memo( Dispatcher );
