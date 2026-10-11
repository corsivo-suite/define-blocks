<?php

define( 'ABSPATH', __DIR__ . '/' );
define( 'WP_CONTENT_DIR', __DIR__ );

final class WP_REST_Server {
	public const READABLE = 'GET';
	public const EDITABLE = 'POST';
}

final class WP_REST_Request {
	public function __construct( private array $params = [] ) {}
	public function get_param( string $key ): mixed { return $this->params[ $key ] ?? null; }
}

final class WP_REST_Response {
	public array $headers = [];
	public function __construct( public mixed $data ) {}
	public function header( string $name, mixed $value ): void { $this->headers[ $name ] = $value; }
}

final class WP_Error {
	public function __construct( public string $code, public string $message = '', public mixed $data = null ) {}
}

final class WP_Post {
	public function __construct( public int $ID, public string $post_content = '', public string $post_type = 'post' ) {}
}

final class WP_Term {
	public function __construct( public int $term_id, public string $name, public string $taxonomy = 'category', public int $parent = 0 ) {}
}

foreach ( [ 'actions', 'filters', 'routes', 'blocks', 'posts', 'parsed_blocks', 'meta', 'meta_updates', 'terms', 'capabilities', 'failures' ] as $key ) {
	$GLOBALS[ 'test_' . $key ] = [];
}
$GLOBALS['test_user_id'] = 1;
$GLOBALS['test_count'] = 0;
$GLOBALS['test_taxonomy'] = (object) [ 'name' => 'category', 'show_ui' => true, 'cap' => (object) [ 'assign_terms' => 'assign_categories' ] ];

function add_action( string $hook, callable $callback, int $priority = 10, int $accepted_args = 1 ): void {
	$GLOBALS['test_actions'][ $hook ][ $priority ][] = [ $callback, $accepted_args ];
}
function do_action( string $hook, mixed ...$args ): void {
	$priorities = $GLOBALS['test_actions'][ $hook ] ?? [];
	ksort( $priorities );
	foreach ( $priorities as $callbacks ) {
		foreach ( $callbacks as [ $callback, $accepted ] ) { $callback( ...array_slice( $args, 0, $accepted ) ); }
	}
}
function add_filter( string $hook, callable $callback, int $priority = 10, int $accepted_args = 1 ): void {
	$GLOBALS['test_filters'][ $hook ][ $priority ][] = [ $callback, $accepted_args ];
}
function apply_filters( string $hook, mixed $value, mixed ...$args ): mixed {
	$priorities = $GLOBALS['test_filters'][ $hook ] ?? [];
	ksort( $priorities );
	foreach ( $priorities as $callbacks ) {
		foreach ( $callbacks as [ $callback, $accepted ] ) { $value = $callback( ...array_slice( [ $value, ...$args ], 0, $accepted ) ); }
	}
	return $value;
}
function register_rest_route( string $namespace, string $route, array $definition ): void { $GLOBALS['test_routes'][ $namespace . $route ] = $definition; }
function __( string $message ): string { return $message; }
function plugin_dir_path( string $file ): string { return dirname( $file ) . '/'; }
function plugin_dir_url( string $file ): string { return 'https://example.test/plugins/define-blocks/'; }
function absint( mixed $value ): int { return abs( (int) $value ); }
function sanitize_key( mixed $value ): string { return preg_replace( '/[^a-z0-9_\-]/', '', strtolower( (string) $value ) ) ?? ''; }
function sanitize_text_field( mixed $value ): string { return is_scalar( $value ) ? trim( strip_tags( (string) $value ) ) : ''; }
function sanitize_textarea_field( mixed $value ): string { return sanitize_text_field( $value ); }
function wp_kses_post( string $value ): string { return strip_tags( $value, '<p><strong><em><a><br>' ); }
function esc_url_raw( mixed $value ): string { return is_string( $value ) && ! preg_match( '/^\s*(javascript|data):/i', $value ) ? trim( $value ) : ''; }
function sanitize_hex_color( string $value ): ?string { return preg_match( '/^#(?:[a-f0-9]{3}|[a-f0-9]{6})$/i', $value ) ? $value : null; }
function safecss_filter_attr( string $value ): string { return preg_match( '/[;{}]|expression|javascript:/i', $value ) ? '' : $value; }
function rest_ensure_response( mixed $value ): WP_REST_Response { return $value instanceof WP_REST_Response ? $value : new WP_REST_Response( $value ); }
function current_user_can( string $capability, mixed ...$args ): bool {
	$key = $capability . ':' . implode( ':', $args );
	return $GLOBALS['test_capabilities'][ $key ] ?? $GLOBALS['test_capabilities'][ $capability ] ?? true;
}
function get_current_user_id(): int { return $GLOBALS['test_user_id']; }
function get_post( int $post_id ): ?WP_Post { return $GLOBALS['test_posts'][ $post_id ] ?? ( $post_id > 0 ? new WP_Post( $post_id ) : null ); }
function get_post_meta( int $post_id, string $key ): mixed { return $GLOBALS['test_meta'][ $post_id ][ $key ] ?? ''; }
function update_post_meta( int $post_id, string $key, mixed $value ): void {
	$GLOBALS['test_meta_updates'][] = [ $post_id, $key, $value ];
	$GLOBALS['test_meta'][ $post_id ][ $key ] = $value;
}
function wp_slash( mixed $value ): mixed { return $value; }
function wp_json_encode( mixed $value ): string|false { return json_encode( $value ); }
function wp_is_post_revision( int $post_id ): bool { return false; }
if ( ! defined( 'DEFB_NATIVE_TESTS' ) ) {
	function parse_blocks( string $content ): array { return $GLOBALS['test_parsed_blocks'][ $content ] ?? []; }
}
function get_taxonomy( string $taxonomy ): object|false { return $taxonomy === $GLOBALS['test_taxonomy']->name ? $GLOBALS['test_taxonomy'] : false; }
function is_wp_error( mixed $value ): bool { return $value instanceof WP_Error; }
function get_terms( array $args ): array|string {
	$terms = array_values( $GLOBALS['test_terms'] );
	if ( ! empty( $args['include'] ) ) {
		$included = array_map( 'intval', $args['include'] );
		$terms = array_values( array_filter( $terms, static fn( WP_Term $term ): bool => in_array( $term->term_id, $included, true ) ) );
		usort( $terms, static fn( WP_Term $left, WP_Term $right ): int => array_search( $left->term_id, $included, true ) <=> array_search( $right->term_id, $included, true ) );
	} else {
		$search = strtolower( (string) ( $args['search'] ?? '' ) );
		if ( $search !== '' ) { $terms = array_values( array_filter( $terms, static fn( WP_Term $term ): bool => str_contains( strtolower( $term->name ), $search ) ) ); }
		usort( $terms, static fn( WP_Term $left, WP_Term $right ): int => $left->name <=> $right->name );
	}
	return ( $args['fields'] ?? '' ) === 'count' ? (string) count( $terms ) : array_slice( $terms, (int) ( $args['offset'] ?? 0 ), (int) ( $args['number'] ?? count( $terms ) ) );
}
function get_ancestors( int $term_id ): array {
	$ancestors = [];
	$current = $GLOBALS['test_terms'][ $term_id ] ?? null;
	while ( $current instanceof WP_Term && $current->parent ) {
		$ancestors[] = $current->parent;
		$current = $GLOBALS['test_terms'][ $current->parent ] ?? null;
	}
	return $ancestors;
}
function get_term( int $term_id ): WP_Term|false { return $GLOBALS['test_terms'][ $term_id ] ?? false; }

function test_case( string $name, callable $test ): void {
	++$GLOBALS['test_count'];
	try {
		$test();
		echo "PASS {$name}\n";
	} catch ( Throwable $error ) {
		$GLOBALS['test_failures'][] = "{$name}: {$error->getMessage()}";
		echo "FAIL {$name}\n";
	}
}
function expect_same( mixed $expected, mixed $actual ): void {
	if ( $expected !== $actual ) { throw new RuntimeException( 'Expected ' . var_export( $expected, true ) . ', got ' . var_export( $actual, true ) ); }
}
function expect_true( bool $condition, string $message = 'Assertion failed.' ): void {
	if ( ! $condition ) { throw new RuntimeException( $message ); }
}
function test_finish(): void {
	if ( $GLOBALS['test_failures'] ) {
		fwrite( STDERR, implode( "\n", $GLOBALS['test_failures'] ) . "\n" );
		exit( 1 );
	}
	echo 'All ' . $GLOBALS['test_count'] . " PHP contract tests passed.\n";
}

require dirname( __DIR__, 2 ) . '/define-blocks.php';
add_filter( 'defb_register', static fn( array $blocks, ?int $post_id ): array => array_replace( $blocks, $GLOBALS['test_blocks'][ $post_id ?? 0 ] ?? [] ), 20, 2 );
do_action( 'rest_api_init' );
