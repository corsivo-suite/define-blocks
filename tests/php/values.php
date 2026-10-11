<?php

require __DIR__ . '/bootstrap.php';

function value_fixture( array $fields, array $values = [] ): array {
	static $post_id = 200;
	++$post_id;
	$definition = [ 'name' => 'test/values', 'schema' => $fields ];
	$schema = defb_resolve_schema( $definition );
	$GLOBALS['test_blocks'][ $post_id ] = [ 'test/values' => $definition ];
	$GLOBALS['test_posts'][ $post_id ] = new WP_Post( $post_id, 'fixture-' . $post_id );
	$GLOBALS['test_parsed_blocks'][ 'fixture-' . $post_id ] = [ [ 'blockName' => 'test/values', 'attrs' => [ 'values' => $values ] ] ];
	$GLOBALS['test_meta_updates'] = [];
	$GLOBALS['test_capabilities'] = [];
	$GLOBALS['test_user_id'] = 1;
	return [ $post_id, $schema ];
}

function write_meta_request( int $post_id, array $metas ): WP_REST_Response|WP_Error {
	$route = $GLOBALS['test_routes']['defb/v1/meta'];
	$request = new WP_REST_Request( [ 'post_id' => $post_id, 'metas' => $metas ] );
	$permission = $route['permission_callback']( $request );
	return is_wp_error( $permission ) ? $permission : $route['callback']( $request );
}

test_case( 'defaults hydrate nested repeaters and flat groups and tabs', static function (): void {
	[ , $schema ] = value_fixture( [
		'layout' => [ 'type' => 'group', 'fields' => [ 'color' => [ 'type' => 'color', 'default' => '#123456' ] ] ],
		'tabs' => [ 'type' => 'tabs', 'tabs' => [ [ 'fields' => [ 'subtitle' => [ 'default' => 'Default subtitle' ] ] ] ] ],
		'rows' => [ 'type' => 'repeater', 'fields' => [
			'group' => [ 'type' => 'group', 'fields' => [ 'title' => [ 'default' => 'New title' ] ] ],
			'children' => [ 'type' => 'repeater', 'default' => [ [] ], 'fields' => [ 'weight' => [ 'type' => 'number', 'default' => '2.5' ] ] ],
		] ],
	] );
	$values = defb_hydrate_values( [ 'rows' => [ [ '_defb_id' => 'a', 'unknown' => [ 'keep' => true ] ] ], 'extra' => 7 ], $schema );
	expect_same( '#123456', $values['color'] );
	expect_same( 'Default subtitle', $values['subtitle'] );
	expect_same( 'New title', $values['rows'][0]['title'] );
	expect_same( 2.5, $values['rows'][0]['children'][0]['weight'] );
	expect_same( [ 'keep' => true ], $values['rows'][0]['unknown'] );
	expect_same( 'a', $values['rows'][0]['_defb_id'] );
	expect_same( 7, $values['extra'] );
	expect_true( ! isset( $values['layout'] ) && ! isset( $values['tabs'] ) );
} );

test_case( 'hydration distinguishes missing values from every explicit empty value', static function (): void {
	$fields = [];
	foreach ( [ 'text', 'nothing', 'enabled', 'items', 'zero' ] as $key ) { $fields[ $key ] = [ 'default' => 'fallback' ]; }
	$fields['rows'] = [ 'type' => 'repeater', 'fields' => [ 'title' => [ 'default' => 'fallback' ] ] ];
	[ , $schema ] = value_fixture( $fields );
	$values = [ 'text' => '', 'nothing' => null, 'enabled' => false, 'items' => [], 'zero' => 0, 'rows' => [ [ 'title' => '' ], [ 'title' => null ] ] ];
	expect_same( $values, defb_hydrate_values( $values, $schema ) );
} );

test_case( 'numeric values hydrate consistently while empty values remain empty', static function (): void {
	[ , $schema ] = value_fixture( [ 'number' => [ 'type' => 'number' ], 'range' => [ 'type' => 'range' ] ] );
	expect_same( [ 'number' => 3, 'range' => 0 ], defb_hydrate_values( [ 'number' => '3', 'range' => '0' ], $schema ) );
	expect_same( [ 'number' => '', 'range' => null ], defb_hydrate_values( [ 'number' => '', 'range' => null ], $schema ) );
	foreach ( [ 'invalid', [], new stdClass(), INF, '1e9999' ] as $value ) {
		expect_true( is_wp_error( defb_normalize_field_value( $value, [ 'type' => 'range' ] ) ) );
	}
} );

test_case( 'native save and REST reject malformed values and sanitized empty required text', static function (): void {
	foreach ( [ [ 'type' => 'text', 'required' => true, 'value' => [ 'bad' ] ], [ 'type' => 'text', 'required' => true, 'value' => '<b></b>' ], [ 'type' => 'range', 'min' => 1, 'value' => 'bad' ] ] as $case ) {
		$value = $case['value'];
		unset( $case['value'] );
		[ $post_id ] = value_fixture( [ 'field' => $case + [ 'saveInMeta' => 'stored' ] ], [ 'field' => $value ] );
		do_action( 'save_post', $post_id, get_post( $post_id ) );
		expect_same( [], $GLOBALS['test_meta_updates'] );
		$response = write_meta_request( $post_id, [ 'stored' => $value ] );
		expect_same( 'defb_invalid_meta_value', $response->code );
		expect_same( [], $GLOBALS['test_meta_updates'] );
	}
} );

test_case( 'custom sanitizers run before custom validation exactly once per persistence attempt', static function (): void {
	$calls = 0;
	$validated = [];
	defb_register_custom_field_sanitizer( 'custom-code', static function ( mixed $value ) use ( &$calls ): string { ++$calls; return strtoupper( sanitize_text_field( $value ) ); } );
	[ $post_id ] = value_fixture( [ 'code' => [
		'type' => 'custom-code', 'saveInMeta' => 'code',
		'validate' => static function ( mixed $value ) use ( &$validated ): bool { $validated[] = $value; return $value === 'READY'; },
	] ], [ 'code' => '<b>ready</b>' ] );
	do_action( 'save_post', $post_id, get_post( $post_id ) );
	expect_same( 1, $calls );
	expect_same( [ [ $post_id, 'code', 'READY' ] ], $GLOBALS['test_meta_updates'] );
	expect_same( [ 'ok' => true ], write_meta_request( $post_id, [ 'code' => '<b>ready</b>' ] )->data );
	expect_same( 2, $calls );
	expect_same( [ 'READY', 'READY' ], $validated );
	expect_same( 'defb_invalid_meta_value', write_meta_request( $post_id, [ 'code' => 'invalid' ] )->code );
} );

test_case( 'nested required values and nested shapes are validated after sanitation', static function (): void {
	foreach ( [ [ [ 'label' => '<b></b>', 'amount' => '2' ] ], [ [ 'label' => 'Valid', 'amount' => 'invalid' ] ], [ 'invalid row' ] ] as $rows ) {
		[ $post_id ] = value_fixture( [ 'rows' => [ 'type' => 'repeater', 'saveInMeta' => 'rows', 'fields' => [
			'tabs' => [ 'type' => 'tabs', 'tabs' => [ [ 'fields' => [ 'label' => [ 'required' => true ] ] ] ] ],
			'amount' => [ 'type' => 'number', 'min' => 1 ],
		] ] ], [ 'rows' => $rows ] );
		do_action( 'save_post', $post_id, get_post( $post_id ) );
		expect_same( [], $GLOBALS['test_meta_updates'] );
		expect_same( 'defb_invalid_meta_value', write_meta_request( $post_id, [ 'rows' => $rows ] )->code );
	}
} );

test_case( 'repeater defaults reach native and REST persistence with unknown keys retained', static function (): void {
	[ $post_id ] = value_fixture( [ 'rows' => [ 'type' => 'repeater', 'saveInMeta' => 'rows', 'fields' => [
		'label' => [ 'type' => 'text', 'default' => 'Default', 'required' => true ],
		'amount' => [ 'type' => 'number', 'default' => '2' ],
	] ] ], [ 'rows' => [ [ '_defb_id' => 'row', 'extra' => 'kept' ] ] ] );
	$expected = [ [ '_defb_id' => 'row', 'extra' => 'kept', 'label' => 'Default', 'amount' => 2 ] ];
	do_action( 'save_post', $post_id, get_post( $post_id ) );
	expect_same( $expected, $GLOBALS['test_meta'][ $post_id ]['rows'] );
	write_meta_request( $post_id, [ 'rows' => [ [ '_defb_id' => 'row', 'extra' => 'kept' ] ] ] );
	expect_same( $expected, $GLOBALS['test_meta'][ $post_id ]['rows'] );
} );

test_case( 'native save enforces edit_post_meta per field and skips its callback', static function (): void {
	$called = false;
	[ $post_id ] = value_fixture( [
		'secret' => [ 'saveInMeta' => '_secret', 'saveCallback' => static function () use ( &$called ): void { $called = true; } ],
		'public' => [ 'saveInMeta' => 'public' ],
	], [ 'secret' => 'hidden', 'public' => 'visible' ] );
	$GLOBALS['test_capabilities'][ 'edit_post_meta:' . $post_id . ':_secret' ] = false;
	do_action( 'save_post', $post_id, get_post( $post_id ) );
	expect_same( [ [ $post_id, 'public', 'visible' ] ], $GLOBALS['test_meta_updates'] );
	expect_same( false, $called );
} );

test_case( 'REST checks every meta capability before writing any field', static function (): void {
	[ $post_id ] = value_fixture( [ 'public' => [ 'saveInMeta' => 'public' ], 'secret' => [ 'saveInMeta' => '_secret' ] ] );
	$GLOBALS['test_capabilities'][ 'edit_post_meta:' . $post_id . ':_secret' ] = false;
	expect_same( 'rest_forbidden_meta', write_meta_request( $post_id, [ 'public' => 'allowed', '_secret' => 'denied' ] )->code );
	expect_same( [], $GLOBALS['test_meta_updates'] );
} );

test_case( 'programmatic native saves remain supported while REST never bypasses meta permissions', static function (): void {
	[ $post_id ] = value_fixture( [ 'field' => [ 'saveInMeta' => 'stored' ] ], [ 'field' => 'programmatic' ] );
	$GLOBALS['test_user_id'] = 0;
	$GLOBALS['test_capabilities']['edit_post_meta'] = false;
	do_action( 'save_post', $post_id, get_post( $post_id ) );
	expect_same( [ [ $post_id, 'stored', 'programmatic' ] ], $GLOBALS['test_meta_updates'] );
	expect_same( 'rest_forbidden_meta', write_meta_request( $post_id, [ 'stored' => 'request' ] )->code );
	expect_same( 'programmatic', $GLOBALS['test_meta'][ $post_id ]['stored'] );
} );

test_case( 'REST validates all requested values before writes', static function (): void {
	[ $post_id ] = value_fixture( [ 'first' => [ 'saveInMeta' => 'first' ], 'second' => [ 'required' => true, 'saveInMeta' => 'second' ] ] );
	expect_same( 'defb_invalid_meta_value', write_meta_request( $post_id, [ 'first' => 'valid', 'second' => '' ] )->code );
	expect_same( [], $GLOBALS['test_meta_updates'] );
} );

test_case( 'REST uses saved sibling context and hidden groups preserve empty values', static function (): void {
	foreach ( [ true, false ] as $visible ) {
		[ $post_id ] = value_fixture( [
			'enabled' => [ 'type' => 'checkbox' ],
			'group' => [ 'type' => 'group', 'condition' => [ 'enabled' => true ], 'fields' => [ 'label' => [ 'required' => true, 'saveInMeta' => 'label' ] ] ],
		], [ 'enabled' => $visible, 'label' => '' ] );
		do_action( 'save_post', $post_id, get_post( $post_id ) );
		$response = write_meta_request( $post_id, [ 'label' => '' ] );
		expect_same( $visible, is_wp_error( $response ) );
		expect_same( $visible ? [] : [ [ $post_id, 'label', '' ], [ $post_id, 'label', '' ] ], $GLOBALS['test_meta_updates'] );
	}
} );

test_case( 'condition comparisons match JavaScript coercion for missing null and empty numbers', static function (): void {
	foreach ( [
		[ [], false ],
		[ [ 'amount' => null ], true ],
		[ [ 'amount' => '' ], true ],
		[ [ 'amount' => ' ' ], true ],
		[ [ 'amount' => false ], true ],
		[ [ 'amount' => 'abc' ], false ],
		[ [ 'amount' => 0 ], true ],
		[ [ 'amount' => -1 ], false ],
	] as [ $values, $expected ] ) {
		expect_same( $expected, defb_evaluate_condition( 'amount >= 0', $values ) );
		expect_same( $expected, defb_evaluate_condition( [ 'amount' => [ 'operator' => '>=', 'value' => 0 ] ], $values ) );
	}
	expect_same( false, defb_evaluate_condition( 'amount == null', [] ) );
	expect_same( true, defb_evaluate_condition( 'amount == null', [ 'amount' => null ] ) );
	expect_same( false, defb_evaluate_condition( [ 'amount' => null ], [] ) );
	expect_same( true, defb_evaluate_condition( [ 'amount' => null ], [ 'amount' => null ] ) );
	expect_same( true, defb_evaluate_condition( 'amount empty', [] ) );
	expect_same( false, defb_evaluate_condition( 'amount !empty', [] ) );
	expect_same( true, defb_evaluate_condition( [ 'amount' => [ 'operator' => 'empty' ] ], [] ) );
	foreach ( [ [], [ 'amount' => null ], [ 'amount' => '' ] ] as $values ) {
		expect_same( false, defb_evaluate_condition( '!!amount', $values ) );
	}
	expect_same( true, defb_evaluate_condition( '!!amount', [ 'amount' => '0' ] ) );
} );

test_case( 'condition relational operators use lexical strings and numeric mixed operands', static function (): void {
	foreach ( [
		[ [ 'left' => '10', 'right' => '2' ], true ],
		[ [ 'left' => '10', 'right' => 2 ], false ],
		[ [ 'left' => 1, 'right' => '2' ], true ],
		[ [ 'left' => '', 'right' => 1 ], true ],
		[ [ 'left' => 'abc', 'right' => 1 ], false ],
		[ [ 'left' => [], 'right' => 1 ], true ],
		[ [ 'left' => [ 10 ], 'right' => 2 ], false ],
	] as [ $values, $expected ] ) {
		expect_same( $expected, defb_evaluate_condition( 'left < right', $values ) );
		expect_same( $expected, defb_evaluate_condition( [ 'left' => [ 'operator' => '<', 'value' => $values['right'] ] ], $values ) );
	}
	expect_same( false, defb_evaluate_condition( '-amount >= 0', [] ) );
	expect_same( true, defb_evaluate_condition( '-amount >= 0', [ 'amount' => null ] ) );
	expect_same( true, defb_evaluate_condition( '(amount || 3) === 3', [] ) );
	expect_same( true, defb_evaluate_condition( '(amount && 3) === 3', [ 'amount' => 1 ] ) );
} );

test_case( 'numeric conditions preserve editor visibility during native and REST meta validation', static function (): void {
	foreach ( [ [ [], false ], [ [ 'amount' => null ], true ], [ [ 'amount' => '' ], true ], [ [ 'amount' => 0 ], true ], [ [ 'amount' => -1 ], false ] ] as [ $values, $visible ] ) {
		[ $post_id ] = value_fixture( [
			'amount' => [ 'type' => 'number' ],
			'label' => [ 'required' => true, 'condition' => 'amount >= 0', 'saveInMeta' => 'label' ],
		], $values + [ 'label' => '' ] );
		do_action( 'save_post', $post_id, get_post( $post_id ) );
		$response = write_meta_request( $post_id, [ 'label' => '' ] );
		expect_same( $visible, is_wp_error( $response ) );
		expect_same( $visible ? [] : [ [ $post_id, 'label', '' ], [ $post_id, 'label', '' ] ], $GLOBALS['test_meta_updates'] );
	}
} );

test_case( 'select numeric defaults and legacy primitive selections remain compatible', static function (): void {
	expect_same( '1', defb_normalize_field_value( 1, [ 'type' => 'select' ] ) );
	$expected = [ [ 'value' => 'one', 'label' => 'one' ], [ 'value' => '2', 'label' => '2' ] ];
	foreach ( [ 'chips', 'taxonomy', 'multi-select', 'multi-autocomplete' ] as $type ) {
		expect_same( $expected, defb_normalize_field_value( [ 'one', 2 ], [ 'type' => $type ] ) );
		expect_same( [ [ 'value' => '3', 'label' => '3' ] ], defb_normalize_field_value( [ [ 'value' => 3 ] ], [ 'type' => $type ] ) );
	}
} );

test_case( 'malformed collection items and object properties are rejected without coercion', static function (): void {
	foreach ( [
		[ 'gallery', [ 'invalid' ] ], [ 'gallery', [ [] ] ], [ 'post-selector', [ [ 'id' => [] ] ] ],
		[ 'media', [ 'url' => [ 'bad' ] ] ], [ 'media', [ 'id' => 'garbage' ] ],
		[ 'google-map', [ 'lat' => 'garbage' ] ], [ 'taxonomy', [ [ 'label' => 'missing value' ] ] ],
		[ 'repeater', [ 'named' => [] ] ], [ 'link', 'not json' ],
	] as [ $type, $value ] ) {
		expect_true( is_wp_error( defb_normalize_field_value( $value, [ 'type' => $type ] ) ), $type . ' accepted malformed shape.' );
	}
	expect_same( [ 'url' => 'https://example.test', 'title' => 'Title' ], defb_normalize_field_value( '{"url":"https://example.test","title":"Title"}', [ 'type' => 'link' ] ) );
} );

test_case( 'preview sanitation shares recursive defaults and rejects malformed values', static function (): void {
	$block = [ 'schema' => [ 'rows' => [ 'type' => 'repeater', 'fields' => [ 'label' => [ 'default' => 'Default' ] ] ], 'amount' => [ 'type' => 'number' ] ] ];
	expect_same( [ 'rows' => [ [ 'label' => 'Default' ] ], 'amount' => 4 ], defb_sanitize_attributes( [ 'rows' => [ [] ], 'amount' => '4' ], $block ) );
	expect_true( is_wp_error( defb_sanitize_attributes( [ 'rows' => [ 'bad' ] ], $block ) ) );
	expect_same( [ 'rows' => [ [] ] ], defb_sanitize_attributes( [ 'rows' => [ [] ] ], $block, false ) );
} );

test_case( 'malformed root values cannot overwrite metadata with defaults', static function (): void {
	[ $post_id ] = value_fixture( [ 'label' => [ 'type' => 'text', 'default' => 'Default', 'saveInMeta' => 'label' ] ] );
	foreach ( [ null, false, 'invalid' ] as $values ) {
		defb_process_save( [ [ 'blockName' => 'test/values', 'attrs' => [ 'values' => $values ] ] ], defb_registered( $post_id ), $post_id );
		expect_same( [], $GLOBALS['test_meta_updates'] );
		$route = $GLOBALS['test_routes']['defb/v1/render'];
		$response = $route['callback']( new WP_REST_Request( [ 'blockName' => 'test/values', 'post_id' => $post_id, 'attributes' => [ 'values' => $values ] ] ) );
		expect_same( 'defb_invalid_field_value', $response->code );
	}
} );

test_finish();
