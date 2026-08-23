let counter = 0;

export function uid() {
	if ( typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function' ) {
		return `defb-${ crypto.randomUUID() }`;
	}
	counter += 1;
	const rand = Math.floor( Math.random() * 1e9 ).toString( 36 );
	return `defb-${ Date.now().toString( 36 ) }-${ counter.toString( 36 ) }-${ rand }`;
}
