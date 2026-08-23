export function shouldReverseCanvasLocation( provider, geocoder ) {
	return provider === 'mapbox' && typeof geocoder?.reverse === 'function';
}

export function createReverseCoordinator() {
	let activeController = null;

	const cancel = () => {
		const controller = activeController;
		activeController = null;
		controller?.abort();
	};

	const run = async ( request, onResolve, onReject ) => {
		cancel();
		const controller = new AbortController();
		activeController = controller;

		try {
			const result = await request( controller.signal );
			if ( activeController === controller && ! controller.signal.aborted ) {
				onResolve( result );
			}
		} catch ( error ) {
			if ( activeController === controller && ! controller.signal.aborted ) {
				onReject?.( error );
			}
		} finally {
			if ( activeController === controller ) {
				activeController = null;
			}
		}
	};

	return { cancel, run };
}
