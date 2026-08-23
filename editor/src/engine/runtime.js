// Custom field bundles may run first and pre-create window.DefineBlocks:
// merge key by key instead of bailing on the whole object.
export function setupRuntime() {
	window.DefineBlocks = window.DefineBlocks || {};
	[ 'Registry', 'Instances', 'Extensions', 'Shared' ].forEach( ( key ) => {
		window.DefineBlocks[ key ] = window.DefineBlocks[ key ] || {};
	} );
}
