<?php

require __DIR__ . '/bootstrap.php';

test_case( 'mixed-case meta keys stay exact through REST reads', static function (): void {
	$post_id = 101;
	$GLOBALS['test_blocks'][ $post_id ] = [
		'test/meta' => [
			'schema' => [
				[ 'scope' => 'content', 'fields' => [ 'label' => [ 'type' => 'text', 'saveInMeta' => 'MyMixedMeta' ] ] ],
			],
		],
	];
	$GLOBALS['test_meta'][ $post_id ]['MyMixedMeta'] = 'Stored value';
	$route = $GLOBALS['test_routes']['defb/v1/posts/meta'];
	expect_same( 'MyMixedMeta', $route['args']['meta']['sanitize_callback']( 'MyMixedMeta' ) );
	$response = $route['callback']( new WP_REST_Request( [
		'post_id' => $post_id,
		'meta'    => 'MyMixedMeta',
	] ) );
	expect_same( 'Stored value', $response->data );
	$forbidden = $route['callback']( new WP_REST_Request( [
		'post_id' => $post_id,
		'meta'    => 'mymixedmeta',
	] ) );
	expect_same( 'rest_forbidden_meta', $forbidden->code );
} );

test_case( 'mixed-case meta keys stay exact through REST writes', static function (): void {
	$GLOBALS['test_meta_updates'] = [];
	$route = $GLOBALS['test_routes']['defb/v1/meta'];
	$route['callback']( new WP_REST_Request( [
		'post_id' => 101,
		'metas'   => [
			'MyMixedMeta' => 'Updated',
			'mymixedmeta' => 'Ignored',
		],
	] ) );
	expect_same( [ [ 101, 'MyMixedMeta', 'Updated' ] ], $GLOBALS['test_meta_updates'] );
} );

$GLOBALS['test_terms'] = [
	1 => new WP_Term( 1, 'Design' ),
	2 => new WP_Term( 2, 'Branding', 'category', 1 ),
	3 => new WP_Term( 3, 'Editorial', 'category', 1 ),
];

test_case( 'taxonomy REST search is paginated', static function (): void {
	$route = $GLOBALS['test_routes']['defb/v1/taxonomy/terms'];
	$response = $route['callback']( new WP_REST_Request( [
		'taxonomy' => 'category',
		'page'     => 2,
		'per_page' => 1,
	] ) );
	expect_same( 1, count( $response->data ) );
	expect_same( 3, $response->headers['X-WP-Total'] );
	expect_same( 3, $response->headers['X-WP-TotalPages'] );
} );

test_case( 'taxonomy REST hydration preserves hierarchy', static function (): void {
	$route = $GLOBALS['test_routes']['defb/v1/taxonomy/terms'];
	$response = $route['callback']( new WP_REST_Request( [
		'taxonomy' => 'category',
		'include'  => [ 2 ],
		'page'     => 1,
		'per_page' => 20,
	] ) );
	expect_same( 'Design › Branding', $response->data[0]['path'] );
	expect_same( 1, $response->data[0]['parent'] );
} );

test_case( 'taxonomy REST search handles empty and invalid results', static function (): void {
	$route = $GLOBALS['test_routes']['defb/v1/taxonomy/terms'];
	$empty = $route['callback']( new WP_REST_Request( [
		'taxonomy' => 'category',
		'search'   => 'missing',
		'page'     => 1,
		'per_page' => 20,
	] ) );
	expect_same( [], $empty->data );
	$invalid = $route['callback']( new WP_REST_Request( [ 'taxonomy' => 'missing' ] ) );
	expect_same( 'bad_taxonomy', $invalid->code );
} );

require_once dirname( __DIR__, 2 ) . '/includes/enqueue.php';

test_case( 'preview CSS scopes root, document and nested selectors', static function (): void {
	$css = ':root{--accent:red} body .card{color:red} @media (min-width:1px){html .title{display:block}} @keyframes fade{from{opacity:0}to{opacity:1}}';
	$scoped = defb_scope_preview_css( $css );
	expect_true( preg_match( '/\.defb-preview\s*\{--accent:red\}/', $scoped ) === 1, 'Root selector was not scoped.' );
	expect_true( preg_match( '/\.defb-preview \.card\s*\{color:red\}/', $scoped ) === 1, 'Body selector was not scoped.' );
	expect_true( preg_match( '/\.defb-preview \.title\s*\{display:block\}/', $scoped ) === 1, 'Nested document selector was not scoped.' );
	expect_true( str_contains( $scoped, '@keyframes fade' ), 'Keyframes were changed.' );
} );

test_finish();
