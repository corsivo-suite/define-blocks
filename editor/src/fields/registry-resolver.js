export function resolveFieldComponent( type, components, extensions, fallback ) {
	return components[ type ] || extensions?.[ type ] || fallback;
}
