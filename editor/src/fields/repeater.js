export function partitionRepeaterFields( fields ) {
	return Object.entries( fields || {} ).reduce( ( partitions, [ key, field ] ) => {
		const target = field?.inline === true ? 'inlineFields' : 'bodyFields';
		partitions[ target ][ key ] = field;
		return partitions;
	}, { inlineFields: {}, bodyFields: {} } );
}
