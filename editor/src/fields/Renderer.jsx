import Dispatcher from './Dispatcher';

export default function FieldsRenderer( { fields } ) {
	if ( ! fields || typeof fields !== 'object' ) {
		return null;
	}

	const entries = Object.entries( fields );
	if ( ! entries.length ) {
		return null;
	}

	const hasWidths = entries.some( ( [ , f ] ) => f.width );

	return (
		<div className={ `defb-fields${ hasWidths ? ' defb-fields--flex' : '' }` }>
			{ entries.map( ( [ name, field ] ) => (
				<Dispatcher key={ name } name={ name } field={ field } />
			) ) }
		</div>
	);
}
