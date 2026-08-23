export default function Title( { field } ) {
	return <h3 className="defb-field-title">{ field.label || field.title || '' }</h3>;
}
