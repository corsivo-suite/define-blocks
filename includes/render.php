<?php
/**
 * Frontend block rendering.
 *
 * @package DefineBlocks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', static function (): void {
	foreach ( defb_registered() as $block ) {
		$name = $block['name'] ?? '';
		if ( ! $name ) {
			continue;
		}

		$captured = $block;
		$defaults = defb_collect_defaults( defb_resolve_schema( $block ) );

		register_block_type( $name, [
			'supports'        => defb_block_supports( $block ),
			'render_callback' => static function ( array $attributes, string $content, \WP_Block $wp_block ) use ( $captured, $defaults ): string {
				$attrs      = $wp_block->parsed_block['attrs'] ?? [];
				$attrs      = is_array( $attrs ) ? $attrs : [];
				$raw_values = $attrs['values'] ?? [];

				$attrs['values'] = array_replace( $defaults, is_array( $raw_values ) ? $raw_values : [] );
				$html            = defb_render_output( $captured, $attrs, $content, $wp_block );

				if ( $html === null ) {
					return $content;
				}

				return defb_wrap_render_output( $captured, $html );
			},
		] );
	}
}, 99 );

/**
 * Resolve and execute a block's render.
 *
 * 1. callable  → call directly
 * 2. file path → include as template
 * 3. null      → try auto-derived function name
 * 4. none      → return null (InnerBlocks only)
 */
function defb_render_output( array $block, array $attributes, string $content, \WP_Block $wp_block ): ?string {
	$render = $block['render'] ?? null;
	$invoke = static fn( callable $fn ) => $fn( $attributes, $content, $wp_block );

	if ( $render !== null && is_callable( $render ) ) {
		return $invoke( $render );
	}

	if ( is_string( $render ) && is_file( $render ) ) {
		$buffer_level = ob_get_level();
		if ( ! ob_start() ) {
			return null;
		}

		try {
			( static function ( string $_tpl, array $attributes, string $content, \WP_Block $block ): void {
				include $_tpl;
			} )( $render, $attributes, $content, $wp_block );
			$output = ob_get_clean();
			return $output === false ? null : $output;
		} catch ( \Throwable $error ) {
			while ( ob_get_level() > $buffer_level ) {
				ob_end_clean();
			}
			throw $error;
		}
	}

	if ( $render === null ) {
		$fn_name = defb_infer_callback( $block['name'] ?? '' );
		if ( $fn_name && function_exists( $fn_name ) ) {
			return $invoke( $fn_name );
		}
	}

	return null;
}

function defb_wrap_render_output( array $block, string $html ): string {
	$extra      = $block['wrapperClass'] ?? '';
	$attributes = get_block_wrapper_attributes( $extra ? [ 'class' => $extra ] : [] );
	return '<div' . ( $attributes ? ' ' . $attributes : '' ) . '>' . $html . '</div>';
}

/**
 * Derive a render callback name from a block name.
 * 'myplugin/hero-banner' → 'myplugin_hero_banner_render'
 */
function defb_infer_callback( string $block_name ): string {
	if ( ! str_contains( $block_name, '/' ) ) {
		return '';
	}
	return str_replace( [ '/', '-' ], '_', $block_name ) . '_render';
}
