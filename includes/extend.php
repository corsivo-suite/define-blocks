<?php
/**
 * Custom field extension API.
 *
 * Lets third-party plugins register new field-type components
 * for the block editor by providing a built JS bundle.
 *
 * Usage:
 *   defb_register_custom_field( __FILE__ );
 *
 * Expects build/index.js (and optionally build/style-index.css)
 * relative to the caller's directory.
 *
 * @package DefineBlocks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function defb_register_custom_field( string $entry_file, array $field_types = [] ): void {
	if ( $field_types ) {
		$GLOBALS['defb_custom_field_types'] = array_values( array_unique( array_merge( $GLOBALS['defb_custom_field_types'] ?? [], array_map( 'sanitize_key', $field_types ) ) ) );
	} else {
		$GLOBALS['defb_untyped_custom_fields'] = true;
	}
	$base_url = plugin_dir_url( $entry_file );
	$base_dir = plugin_dir_path( $entry_file );
	$handle   = 'defb-cf-' . basename( dirname( $entry_file ) );

	add_action( 'enqueue_block_editor_assets', static function () use ( $base_url, $base_dir, $handle ): void {
		$js_path = $base_dir . 'build/index.js';
		if ( ! file_exists( $js_path ) ) {
			return;
		}

		$asset_path = $base_dir . 'build/index.asset.php';
		$asset      = file_exists( $asset_path ) ? include $asset_path : [];

		wp_enqueue_script(
			$handle,
			$base_url . 'build/index.js',
			$asset['dependencies'] ?? [ 'wp-blocks', 'wp-i18n', 'wp-element' ],
			$asset['version'] ?? (string) filemtime( $js_path ),
			true,
		);
	}, 5 );

	$enqueue_style = static function () use ( $base_url, $base_dir, $handle ): void {
		$css_path = $base_dir . 'build/style-index.css';
		if ( file_exists( $css_path ) ) {
			wp_enqueue_style(
				$handle,
				$base_url . 'build/style-index.css',
				[],
				(string) filemtime( $css_path ),
			);
			wp_style_add_data( $handle, 'rtl', 'replace' );
		}
	};

	add_action( 'enqueue_block_editor_assets', $enqueue_style, 5 );
	add_action( 'enqueue_block_assets', static function () use ( $enqueue_style ): void {
		if ( is_admin() ) {
			$enqueue_style();
		}
	}, 5 );
}

function defb_register_custom_field_sanitizer( string $field_type, callable $sanitizer ): void {
	$field_type = sanitize_key( $field_type );

	if ( '' === $field_type ) {
		return;
	}

	$GLOBALS['defb_custom_field_sanitizers'][ $field_type ] = $sanitizer;
}

function defb_get_custom_field_sanitizer( string $field_type ): ?callable {
	$field_type = sanitize_key( $field_type );
	$registry   = $GLOBALS['defb_custom_field_sanitizers'] ?? array();
	$sanitizer  = $registry[ $field_type ] ?? null;

	return is_callable( $sanitizer ) ? $sanitizer : null;
}
