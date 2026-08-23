const ALIASES = window.defineBlocks?.fieldAliases || {};

export function resolveType( type ) {
	if ( ! type ) {
		return 'text';
	}
	const normalized = type.toLowerCase().trim();
	return ALIASES[ normalized ] || normalized;
}
