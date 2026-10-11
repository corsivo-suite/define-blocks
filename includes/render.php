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
		defb_register_server_block( $block );
	}
	$GLOBALS['defb_registration_complete'] = true;
}, 99 );

function defb_register_server_block( array $block ): void {
	$name = $block['name'];
	if ( WP_Block_Type_Registry::get_instance()->is_registered( $name ) ) {
		return;
	}
	defb_check_block_schema( $block );
	$settings = [
		'api_version' => 3,
		'attributes' => [
			'values' => [ 'type' => 'object', 'default' => defb_hydrate_values( [], defb_resolve_schema( $block ) ) ],
			'isPreview' => [ 'type' => 'boolean', 'default' => ! empty( $block['settings']['startPreview'] ) ],
			'collapsed' => [ 'type' => 'boolean', 'default' => false ],
		],
		'supports' => defb_block_supports( $block ),
		'uses_context' => array_values( array_unique( array_merge( [ 'postId', 'postType' ], array_filter( is_array( $block['usesContext'] ?? null ) ? $block['usesContext'] : [], 'is_string' ) ) ) ),
		'render_callback' => static function ( array $attributes, string $content, WP_Block $wp_block ) use ( $name, $block ): string {
			$post_id = absint( $wp_block->context['postId'] ?? get_the_ID() );
			$definition = defb_registered( $post_id ?: null )[ $name ] ?? $block;
			$raw_values = $wp_block->parsed_block['attrs']['values'] ?? [];
			$attributes['values'] = defb_hydrate_values( is_array( $raw_values ) ? $raw_values : [], defb_resolve_schema( $definition ) );
			$html = defb_render_output( $definition, $attributes, $content, $wp_block );
			return $html === null ? $content : defb_wrap_render_output( $definition, $html );
		},
	];
	foreach ( [ 'parent' => 'parent', 'ancestor' => 'ancestor', 'providesContext' => 'provides_context' ] as $key => $native_key ) {
		if ( isset( $block[ $key ] ) && is_array( $block[ $key ] ) ) {
			$settings[ $native_key ] = $block[ $key ];
		}
	}
	register_block_type( $name, $settings );
}

add_filter( 'render_block_data', static function ( array $parsed, array $source, ?WP_Block $parent ): array {
	$post_id = absint( $parent->context['postId'] ?? get_the_ID() );
	$definitions = defb_registered( $post_id ?: null );
	foreach ( $definitions as $definition ) {
		defb_register_server_block( $definition );
	}
	return $parsed;
}, 10, 3 );

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
