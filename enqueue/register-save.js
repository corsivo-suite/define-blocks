( function () {
	if ( typeof wp === 'undefined' || ! wp.data ) {
		return;
	}

	const select = wp.data.select;
	const subscribe = wp.data.subscribe;

	let wasSaving = false;

	subscribe( function () {
		const editor = select( 'core/editor' );
		const isSaving = editor.isSavingPost();
		const isAutosaving = editor.isAutosavingPost();

		if ( wasSaving && ! isSaving && ! isAutosaving && editor.didPostSaveRequestSucceed() ) {
			wp.hooks.doAction( 'defineBlocks.afterSavePost' );
		}

		wasSaving = isSaving && ! isAutosaving;
	} );
} )();
