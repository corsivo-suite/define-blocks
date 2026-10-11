<?php

if (PHP_SAPI !== 'cli') { exit(1); }

require __DIR__ . '/bootstrap.php';

function get_post_types( array $criteria, string $output ): array {
	$types = [
		'post' => (object) [ 'name' => 'post', 'public' => true, 'show_ui' => true, 'cap' => (object) [ 'edit_posts' => 'edit_posts' ] ],
		'shop_coupon' => (object) [ 'name' => 'shop_coupon', 'public' => false, 'show_ui' => true, 'cap' => (object) [ 'edit_posts' => 'edit_shop_coupons' ] ],
	];
	foreach ( $criteria as $property => $expected ) {
		$types = array_filter( $types, static fn( object $type ): bool => $type->$property === $expected );
	}
	return $output === 'names' ? array_keys( $types ) : $types;
}

$permission = $GLOBALS['test_routes']['defb/v1/posts/preview/(?P<id>\d+)']['permission_callback'];
$GLOBALS['test_posts'][10] = new WP_Post( 10 );
$GLOBALS['test_posts'][20] = new WP_Post( 20, '', 'shop_coupon' );

test_case( 'a customer with read_post cannot use editor previews', static function () use ( $permission ): void {
	$GLOBALS['test_capabilities'] = [ 'read_post' => true, 'edit_posts' => false, 'edit_shop_coupons' => false ];
	expect_same( 'rest_forbidden', $permission( new WP_REST_Request( [ 'id' => 10 ] ) )->code );
	expect_same( 'rest_forbidden', $permission( new WP_REST_Request( [ 'id' => 20 ] ) )->code );
} );

test_case( 'editor previews are restricted to selectable post types', static function () use ( $permission ): void {
	$GLOBALS['test_capabilities'] = [ 'read_post' => true, 'edit_posts' => true ];
	expect_same( true, $permission( new WP_REST_Request( [ 'id' => 10 ] ) ) );
	expect_same( 'rest_forbidden', $permission( new WP_REST_Request( [ 'id' => 20 ] ) )->code );
} );

test_case( 'editor permission does not bypass object read permission', static function () use ( $permission ): void {
	$GLOBALS['test_capabilities'] = [ 'read_post:10' => false, 'edit_posts' => true ];
	expect_same( 'rest_forbidden', $permission( new WP_REST_Request( [ 'id' => 10 ] ) )->code );
	expect_same( 'rest_forbidden', $permission( new WP_REST_Request( [ 'id' => 0 ] ) )->code );
} );

test_finish();
