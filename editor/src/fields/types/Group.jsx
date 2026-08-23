import FieldsRenderer from '../Renderer';
import { BaseControl } from '@wordpress/components';

export default function Group( { name, field, renderFields } ) {
	if ( ! field.fields ) {
		return null;
	}

	const content = renderFields
		? renderFields( field.fields )
		: <FieldsRenderer fields={ field.fields } />;

	return (
		<BaseControl id={ name } label={ field.label }>
			{ content }
		</BaseControl>
	);
}
