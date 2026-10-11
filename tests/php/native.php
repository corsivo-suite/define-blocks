<?php

define( 'DEFB_NATIVE_TESTS', true );
require __DIR__ . '/bootstrap.php';

$wordpress_root = getenv( 'DEFB_WP_ROOT' ) ?: dirname( __DIR__, 5 );
if ( ! is_file( $wordpress_root . '/wp-includes/blocks.php' ) ) {
	fwrite( STDERR, "Set DEFB_WP_ROOT to a WordPress checkout to run native block contracts. No database is loaded.\n" );
	exit( 1 );
}
foreach ( [ 'class-wp-block-type', 'class-wp-block-type-registry', 'class-wp-block', 'class-wp-block-list', 'class-wp-block-supports', 'class-wp-block-parser', 'blocks' ] as $file ) {
	require $wordpress_root . '/wp-includes/' . $file . '.php';
}

function wp_parse_args( mixed $args, array $defaults = [] ): array { return array_merge( $defaults, (array) $args ); }
function rest_validate_value_from_schema( mixed $value, array $schema, string $name ): bool|WP_Error {
	$valid = match ( $schema['type'] ?? '' ) {
		'object', 'array' => is_array( $value ),
		'boolean' => is_bool( $value ),
		'number' => is_int( $value ) || is_float( $value ),
		'string' => is_string( $value ),
		default => true,
	};
	return $valid ? true : new WP_Error( 'rest_invalid_type' );
}
function get_the_ID(): int { return $GLOBALS['post']->ID ?? 0; }
function setup_postdata( WP_Post $post ): void { $GLOBALS['test_postdata'] = $post->ID; }
function wp_reset_postdata(): void { unset( $GLOBALS['test_postdata'] ); }
function get_block_bindings_supported_attributes( string $name ): array { return []; }
function did_action( string $hook ): int { return 0; }
function wp_styles(): object { static $styles; return $styles ??= (object) [ 'queue' => [] ]; }
function wp_scripts(): object { static $scripts; return $scripts ??= (object) [ 'queue' => [] ]; }
function wp_script_modules(): object { static $modules; return $modules ??= new class { public function get_queue(): array { return []; } }; }
function esc_html( string $value ): string { return htmlspecialchars( $value, ENT_QUOTES ); }
function esc_attr( string $value ): string { return htmlspecialchars( $value, ENT_QUOTES ); }
function _doing_it_wrong( string $function, string $message, string $version ): void { $GLOBALS['test_warnings'][] = $message; }
