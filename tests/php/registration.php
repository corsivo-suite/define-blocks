<?php

require __DIR__ . '/native.php';

function native_block_content( string $name, array $values = [], string $content = '' ): string {
	return '<!-- wp:' . $name . ' ' . serialize_block_attributes( [ 'values' => $values ] ) . ' -->' . $content . '<!-- /wp:' . $name . ' -->';
}

function preview_response( int $post_id, string $name, array $values = [], string $content = '', array $context = [] ): WP_REST_Response|WP_Error {
	$request = new WP_REST_Request( [ 'post_id' => $post_id, 'blockName' => $name, 'attributes' => [ 'values' => $values ], 'content' => $content, 'context' => $context ] );
	$route = $GLOBALS['test_routes']['defb/v1/render'];
	$permission = $route['permission_callback']( $request );
	return is_wp_error( $permission ) ? $permission : $route['callback']( $request );
}

$GLOBALS['test_blocks'][0] = [
	'test/runtime' => [ 'render' => 'test_late_runtime_render', 'schema' => [ 'label' => [ 'type' => 'text', 'default' => 'Global' ] ] ],
	'test/inferred' => [ 'schema' => [ 'label' => [ 'type' => 'text', 'default' => 'Inferred' ] ] ],
	'test/file' => [ 'render' => __DIR__ . '/fixtures/render.php', 'schema' => [ 'label' => [ 'type' => 'text', 'default' => 'File' ] ] ],
	'test/fallback' => [ 'schema' => [ 'children' => [ 'type' => 'innerblocks' ] ] ],
	'test/parent' => [ 'parent' => [ 'core/group' ], 'ancestor' => [ 'core/post-template' ], 'providesContext' => [ 'test/values' => 'values' ], 'schema' => [ 'label' => [ 'type' => 'text', 'default' => 'Global context' ] ] ],
	'test/child' => [ 'usesContext' => [ 'test/values', 'site/color' ], 'schema' => [], 'render' => static fn( array $attributes, string $content, WP_Block $block ): string => wp_json_encode( $block->context ) ],
];
foreach ( $GLOBALS['test_blocks'][0] as $name => $definition ) {
	define_block_type( $name, $definition );
}

test_case( 'native registration exposes attributes and parent ancestor context contracts', static function (): void {
	$register = $GLOBALS['test_actions']['init'][99][0][0];
	$register();
	$type = WP_Block_Type_Registry::get_instance()->get_registered( 'test/parent' );
	expect_same( 3, $type->api_version );
	expect_same( 'object', $type->attributes['values']['type'] );
	expect_same( [ 'core/group' ], $type->parent );
	expect_same( [ 'core/post-template' ], $type->ancestor );
	expect_same( [ 'test/values' => 'values' ], $type->provides_context );
	expect_true( in_array( 'postId', $type->uses_context, true ) );
	expect_true( in_array( 'postType', $type->uses_context, true ) );
} );

test_case( 'runtime explicit and inferred callbacks may load after registration', static function (): void {
	expect_true( ! function_exists( 'test_late_runtime_render' ) );
	function test_late_runtime_render( array $attributes, string $content, WP_Block $block ): string {
		return $attributes['values']['label'] . '|' . $content . '|' . $block->context['postId'];
	}
	function test_inferred_render( array $attributes, string $content, WP_Block $block ): string {
		return $attributes['values']['label'] . '|' . $content . '|' . $block->context['postId'];
	}
	$GLOBALS['post'] = new WP_Post( 301 );
	expect_same( '<div>Global|<p>Child</p>|301</div>', render_block( parse_blocks( native_block_content( 'test/runtime', [], '<p>Child</p>' ) )[0] ) );
	expect_same( '<div>Inferred||301</div>', render_block( parse_blocks( native_block_content( 'test/inferred' ) )[0] ) );
} );

test_case( 'file render and absent render preserve native inner content contracts', static function (): void {
	$GLOBALS['post'] = new WP_Post( 302 );
	expect_same( '<div>File|<p>Child</p>|302</div>', render_block( parse_blocks( native_block_content( 'test/file', [], '<p>Child</p>' ) )[0] ) );
	expect_same( '<p>Child</p>', render_block( parse_blocks( native_block_content( 'test/fallback', [], '<p>Child</p>' ) )[0] ) );
} );

test_case( 'post-specific schemas produce identical read frontend and REST preview values', static function (): void {
	$post_id = 303;
	$fields = [ 'label' => [ 'type' => 'text', 'default' => 'Contextual' ], 'rows' => [ 'type' => 'repeater', 'fields' => [ 'weight' => [ 'type' => 'number', 'default' => '2' ] ] ] ];
	$GLOBALS['test_blocks'][ $post_id ] = [ 'test/runtime' => [ 'schema' => $fields, 'render' => static fn( array $attributes ): string => wp_json_encode( $attributes['values'] ) ] ];
	$content = native_block_content( 'test/runtime', [ 'rows' => [ [ 'extra' => 'kept' ] ] ] );
	$GLOBALS['post'] = $GLOBALS['test_posts'][ $post_id ] = new WP_Post( $post_id, $content );
	$expected = [ 'rows' => [ [ 'extra' => 'kept', 'weight' => 2 ] ], 'label' => 'Contextual' ];
	expect_same( $expected, defb_get_block( $post_id, 'test/runtime' ) );
	$frontend = render_block( parse_blocks( $content )[0] );
	expect_same( '<div>' . wp_json_encode( $expected ) . '</div>', $frontend );
	expect_same( $frontend, preview_response( $post_id, 'test/runtime', [ 'rows' => [ [ 'extra' => 'kept' ] ] ] )->data );
} );

test_case( 'post-specific-only blocks render and preview without global registration', static function (): void {
	$post_id = 304;
	$GLOBALS['test_blocks'][ $post_id ] = [ 'test/only-context' => [ 'schema' => [ 'label' => [ 'type' => 'text', 'default' => 'Only contextual' ] ], 'render' => 'test_late_runtime_render' ] ];
	$GLOBALS['post'] = $GLOBALS['test_posts'][ $post_id ] = new WP_Post( $post_id );
	expect_true( ! WP_Block_Type_Registry::get_instance()->is_registered( 'test/only-context' ) );
	expect_same( '<div>Only contextual||304</div>', preview_response( $post_id, 'test/only-context' )->data );
	expect_same( '<div>Only contextual||304</div>', render_block( parse_blocks( native_block_content( 'test/only-context' ) )[0] ) );
} );

test_case( 'native contextual post identity wins over the surrounding document defaults', static function (): void {
	$GLOBALS['post'] = new WP_Post( 301 );
	add_filter( 'render_block_context', static function ( array $context, array $parsed ): array {
		if ( ( $parsed['attrs']['contextFixture'] ?? false ) === true ) {
			$context['postId'] = 303;
		}
		return $context;
	}, 10, 2 );
	$parsed = parse_blocks( native_block_content( 'test/runtime', [ 'rows' => [ [] ] ] ) )[0];
	$parsed['attrs']['contextFixture'] = true;
	$rendered = render_block( $parsed );
	$values = json_decode( substr( $rendered, 5, -6 ), true );
	expect_same( 'Contextual', $values['label'] );
} );

test_case( 'native context forwards saved parent attributes equally in frontend and preview', static function (): void {
	$post_id = 305;
	$GLOBALS['test_blocks'][ $post_id ] = [
		'test/parent' => [ 'providesContext' => [ 'test/values' => 'values' ], 'schema' => [
			'label' => [ 'type' => 'text', 'default' => 'Contextual parent' ],
			'rows' => [ 'type' => 'repeater', 'fields' => [ 'label' => [ 'type' => 'text', 'default' => 'Row default' ] ] ],
		] ],
		'test/child' => $GLOBALS['test_blocks'][0]['test/child'],
	];
	$GLOBALS['post'] = $GLOBALS['test_posts'][ $post_id ] = new WP_Post( $post_id );
	$children = native_block_content( 'test/child' );
	$values = [ 'explicit' => 'Saved value', 'rows' => [ [ 'extra' => 'kept' ] ] ];
	$frontend = render_block( parse_blocks( native_block_content( 'test/parent', $values, $children ) )[0] );
	$context = json_decode( substr( $frontend, 5, -6 ), true );
	expect_same( $values, $context['test/values'] );
	expect_same( $post_id, $context['postId'] );
	expect_same( $frontend, preview_response( $post_id, 'test/parent', $values, $children )->data );
} );

test_case( 'native context uses type defaults only when the top-level attribute is absent', static function (): void {
	$GLOBALS['post'] = new WP_Post( 305 );
	$children = native_block_content( 'test/child' );
	$markup = '<!-- wp:test/parent -->' . $children . '<!-- /wp:test/parent -->';
	$rendered = render_block( parse_blocks( $markup )[0] );
	$context = json_decode( substr( $rendered, 5, -6 ), true );
	expect_same( [ 'label' => 'Global context' ], $context['test/values'] );
	$explicit_empty = render_block( parse_blocks( native_block_content( 'test/parent', [], $children ) )[0] );
	$context = json_decode( substr( $explicit_empty, 5, -6 ), true );
	expect_same( [], $context['test/values'] );
	expect_same( $explicit_empty, preview_response( 305, 'test/parent', [], $children )->data );
} );

test_case( 'preview forwards declared context and locks post identity to authorized target', static function (): void {
	$post_id = 306;
	$GLOBALS['test_blocks'][ $post_id ] = [ 'test/child' => $GLOBALS['test_blocks'][0]['test/child'] ];
	$GLOBALS['test_posts'][ $post_id ] = new WP_Post( $post_id, '', 'page' );
	$response = preview_response( $post_id, 'test/child', [], '', [ 'postId' => 999, 'postType' => 'secret', 'site/color' => 'red', 'not/declared' => 'hidden' ] );
	$context = json_decode( substr( $response->data, 5, -6 ), true );
	expect_same( [ 'postId' => $post_id, 'postType' => 'page', 'site/color' => 'red' ], $context );
	$GLOBALS['test_capabilities'][ 'edit_post:' . $post_id ] = false;
	expect_same( 'rest_forbidden', preview_response( $post_id, 'test/child' )->code );
	$GLOBALS['test_capabilities'] = [];
} );

test_case( 'preview applies native output filters once after rendering parent and children', static function (): void {
	$post_id = 308;
	$render_calls = [];
	$filter_calls = [];
	$GLOBALS['test_blocks'][ $post_id ] = [
		'test/filter-parent' => [ 'render' => static function ( array $attributes, string $content ) use ( &$render_calls ): string {
			$render_calls[] = 'parent';
			return '<section>' . $content . '</section>';
		} ],
		'test/filter-child' => [ 'render' => static function () use ( &$render_calls ): string {
			$render_calls[] = 'child';
			return 'Child';
		} ],
	];
	add_filter( 'render_block', static function ( string $html, array $parsed ) use ( &$filter_calls ): string {
		if ( in_array( $parsed['blockName'], [ 'test/filter-parent', 'test/filter-child' ], true ) ) {
			$filter_calls[] = [ 'generic', $parsed['blockName'], $html ];
			return str_replace( [ 'Child', '<section>', '</section>' ], [ 'Generic child', '<article>', '</article>' ], $html );
		}
		return $html;
	}, 10, 2 );
	add_filter( 'render_block_test/filter-child', static function ( string $html ) use ( &$filter_calls ): string {
		$filter_calls[] = [ 'child', $html ];
		return str_replace( 'Generic child', 'Filtered child', $html );
	} );
	add_filter( 'render_block_test/filter-parent', static function ( string $html ) use ( &$filter_calls ): string {
		$filter_calls[] = [ 'parent', $html ];
		return str_replace( 'Filtered child', 'Final child', $html );
	} );

	$children = native_block_content( 'test/filter-child' );
	$response = preview_response( $post_id, 'test/filter-parent', [], $children );
	expect_same( '<div><article><div>Final child</div></article></div>', $response->data );
	expect_same( [ 'child', 'parent' ], $render_calls );
	expect_same( [
		[ 'generic', 'test/filter-child', '<div>Child</div>' ],
		[ 'child', '<div>Generic child</div>' ],
		[ 'generic', 'test/filter-parent', '<div><section><div>Filtered child</div></section></div>' ],
		[ 'parent', '<div><article><div>Filtered child</div></article></div>' ],
	], $filter_calls );
	$GLOBALS['post'] = new WP_Post( $post_id );
	expect_same( $response->data, render_block( parse_blocks( native_block_content( 'test/filter-parent', [], $children ) )[0] ) );
} );

test_case( 'preview preserves allowed inherited HTML while respecting unfiltered_html capability', static function (): void {
	$post_id = 309;
	$GLOBALS['test_blocks'][ $post_id ] = [ 'test/child' => $GLOBALS['test_blocks'][0]['test/child'] ];
	$context = [ 'test/values' => [ 'label' => '<strong>Bold</strong>', 'rows' => [ [ 'label' => '<em>Italic</em>' ] ] ] ];
	$GLOBALS['test_capabilities']['unfiltered_html'] = false;
	$response = preview_response( $post_id, 'test/child', [], '', $context );
	$received = json_decode( substr( $response->data, 5, -6 ), true );
	expect_same( $context['test/values'], $received['test/values'] );
	$context['test/values']['label'] = '<strong>Bold</strong><script>evil()</script>';
	$response = preview_response( $post_id, 'test/child', [], '', $context );
	$received = json_decode( substr( $response->data, 5, -6 ), true );
	expect_same( '<strong>Bold</strong>evil()', $received['test/values']['label'] );
	$GLOBALS['test_capabilities']['unfiltered_html'] = true;
	$response = preview_response( $post_id, 'test/child', [], '', $context );
	$received = json_decode( substr( $response->data, 5, -6 ), true );
	expect_same( $context['test/values'], $received['test/values'] );
	$GLOBALS['test_capabilities'] = [];
} );

test_case( 'preview restores global post and block supports state when callback throws', static function (): void {
	$post_id = 307;
	$GLOBALS['test_blocks'][ $post_id ] = [ 'test/throwing' => [ 'render' => static function (): string { throw new RuntimeException( 'Expected failure' ); } ] ];
	$previous = new WP_Post( 900 );
	$GLOBALS['post'] = $previous;
	WP_Block_Supports::$block_to_render = [ 'blockName' => 'test/previous' ];
	expect_same( 'render_fail', preview_response( $post_id, 'test/throwing' )->code );
	expect_same( $previous, $GLOBALS['post'] );
	expect_same( 900, $GLOBALS['test_postdata'] );
	expect_same( [ 'blockName' => 'test/previous' ], WP_Block_Supports::$block_to_render );
} );

test_case( 'diagnostics report malformed fields and names colliding in flat storage', static function (): void {
	$issues = defb_schema_diagnostics( [ 'name' => 'test/schema', 'schema' => [
		'label' => [ 'type' => 'text' ], 'invalid' => false,
		'group' => [ 'type' => 'group', 'fields' => [ 'label' => [ 'type' => 'text' ] ] ],
		'rows' => [ 'type' => 'repeater', 'fields' => [ 'label' => [ 'type' => 'text' ] ] ],
	] ] );
	expect_same( [ 'schema.invalid', 'schema.group.fields.label' ], array_column( $issues, 'path' ) );
} );

test_case( 'malformed schema containers produce diagnostics and normalize without runtime errors', static function (): void {
	$block = [ 'name' => 'test/malformed', 'supports' => 'invalid', 'settings' => false, 'schema' => [
		'group' => [ 'type' => 'group', 'fields' => 'invalid' ],
		'tabs' => [ 'type' => 'tabs', 'tabs' => 'invalid' ],
	] ];
	expect_same( [ 'supports', 'settings', 'schema.group.fields', 'schema.tabs.tabs' ], array_column( defb_schema_diagnostics( $block ), 'path' ) );
	expect_same( defb_default_supports(), defb_block_supports( $block ) );
	$schema = defb_resolve_schema( $block );
	expect_same( [], $schema['content']['fields']['group']['fields'] );
	expect_same( [], $schema['content']['fields']['tabs']['tabs'] );
	expect_same( [], defb_hydrate_values( [], $schema ) );
	defb_register_server_block( $block );
	expect_true( WP_Block_Type_Registry::get_instance()->is_registered( 'test/malformed' ) );
} );

test_case( 'diagnostics distinguish valid row and root conditions from inaccessible names', static function (): void {
	$issues = defb_schema_diagnostics( [ 'name' => 'test/schema', 'schema' => [
		'layout' => [ 'type' => 'text' ],
		'rows' => [ 'type' => 'repeater', 'fields' => [
			'valid' => [ 'type' => 'text', 'condition' => 'root.layout === "cards" && $index >= 0' ],
			'missing' => [ 'type' => 'text', 'condition' => 'root.unknown === 1' ],
			'inaccessible' => [ 'type' => 'text', 'condition' => [ 'layout' => 'cards' ] ],
			'malformed' => [ 'type' => 'text', 'condition' => 'root.layout ===' ],
		] ],
	] ] );
	expect_same( [ 'schema.rows.fields.missing.condition', 'schema.rows.fields.inaccessible.condition', 'schema.rows.fields.malformed.condition' ], array_column( $issues, 'path' ) );
} );

test_case( 'diagnostics support declared custom fields and native toolbar attributes', static function (): void {
	defb_register_custom_field_sanitizer( 'custom-shaped', static fn( mixed $value ): mixed => $value );
	$issues = defb_schema_diagnostics( [ 'name' => 'test/schema', 'providesContext' => [ 'site/alignment' => 'align' ], 'schema' => [
		'custom' => [ 'type' => 'custom-shaped', 'customProperty' => true ],
		'toggle' => [ 'type' => 'checkbox', 'icon' => 'star-filled' ],
		'unknown' => [ 'type' => 'misspelled' ],
	] ] );
	expect_same( [ 'schema.unknown.type' ], array_column( $issues, 'path' ) );
} );

test_case( 'diagnostics flag unsupported InnerBlocks layouts and accept content-only blocks', static function (): void {
	expect_same( [], defb_schema_diagnostics( [ 'name' => 'test/content-only', 'schema' => [ 'content' => [ 'type' => 'innerblocks' ] ] ] ) );
	$issues = defb_schema_diagnostics( [ 'name' => 'test/schema', 'schema' => [ 'content' => [ 'type' => 'innerblocks' ], 'rows' => [ 'type' => 'repeater', 'fields' => [ 'content' => [ 'type' => 'innerblocks' ] ] ] ] ] );
	expect_same( 2, count( $issues ) );
	expect_true( str_contains( $issues[0]['message'], 'repeater' ) );
	expect_true( str_contains( $issues[1]['message'], 'one InnerBlocks' ) );
} );

test_case( 'preview CSS scopes document chains and comments without changing quoted selector content', static function (): void {
	$css = '/* theme { ; } */ html body .card, :where([data-note="a;b"]) {content:"}"} /* nested */ @media (min-width:1px) {/* root */ :root{--label:"/*literal*/"}}';
	$scoped = defb_scope_preview_css( $css );
	expect_true( str_contains( $scoped, '.defb-preview .card, .defb-preview :where([data-note="a;b"]) {content:"}"}' ), $scoped );
	expect_true( str_contains( $scoped, '.defb-preview {--label:"/*literal*/"}' ), $scoped );
	expect_true( ! str_contains( $scoped, '.defb-preview @media' ) );
	expect_same( '.defb-preview [data-note="/*literal*/"] {color:red}', defb_scope_preview_css( '[data-note="/*literal*/"]{color:red}' ) );
} );

test_finish();
