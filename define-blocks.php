<?php
/**
 * Plugin Name:       Define Blocks
 * Plugin URI:        https://github.com/salvatorecorsi/define-blocks
 * Description:       Define native blocks with pure PHP.
 * Version:           1.1.0
 * Update URI:        https://www.corsivo.dev/plugins/define-blocks
 * Requires at least: 6.6
 * Requires PHP:      8.1
 * Author:            Salvatore Corsi
 * Author URI:        https://salvatorecorsi.com
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       define-blocks
 * Domain Path:       /languages
 *
 * Copyright (C) 2026 Salvatore Corsi
 *
 * This program is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'init', static function (): void {
	load_plugin_textdomain( 'define-blocks', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
} );

add_action( 'enqueue_block_editor_assets', static function (): void {
	wp_set_script_translations(
		'defb-editor',
		'define-blocks',
		plugin_dir_path( __FILE__ ) . 'languages'
	);
}, 100 );

// ── Field persistence on save ──────────────────────────────────────

add_action( 'save_post', static function ( int $post_id, \WP_Post $post ): void {
	if ( wp_is_post_revision( $post_id ) || defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) {
		return;
	}

	$registered = defb_registered( $post_id );
	if ( empty( $registered ) ) {
		return;
	}

	defb_process_save( parse_blocks( $post->post_content ), $registered, $post_id );
}, 10, 2 );

function defb_process_save( array $blocks, array $registered, int $post_id ): void {
	foreach ( $blocks as $block ) {
		if ( ! is_array( $block ) ) {
			continue;
		}

		$name = $block['blockName'] ?? '';

		if ( isset( $registered[ $name ] ) ) {
			$schema      = defb_resolve_schema( $registered[ $name ] );
			$raw_values  = $block['attrs']['values'] ?? [];
			$values      = is_array( $raw_values ) ? $raw_values : [];
			$values      = array_replace( defb_collect_defaults( $schema ), $values );

			defb_run_field_saves( $schema, $values, $post_id );
		}

		if ( ! empty( $block['innerBlocks'] ) && is_array( $block['innerBlocks'] ) ) {
			defb_process_save( $block['innerBlocks'], $registered, $post_id );
		}
	}
}

function defb_run_field_saves( array $schema, array $values, int $post_id ): void {
	foreach ( defb_schema_field_sets( $schema ) as $fields ) {
		defb_run_field_map_saves( $fields, $values, $post_id, $values );
	}
}

function defb_run_field_map_saves(
	array $fields,
	array $values,
	int $post_id,
	array $root_values,
	bool $validation_enabled = true,
	bool $save_enabled = true,
): void {
	foreach ( $fields as $key => $field ) {
		if ( ! is_array( $field ) ) {
			continue;
		}

		$value      = array_key_exists( $key, $values ) ? $values[ $key ] : ( $field['default'] ?? null );
		$is_visible = $validation_enabled && defb_field_is_visible_for_save( $field, $values );
		$valid      = $is_visible
			? defb_validate_field_for_save( $value, $field, $key, $post_id, $root_values )
			: true;
		$can_save   = $save_enabled && $valid !== false && ! is_string( $valid );

		if ( $can_save && ! empty( $field['saveInMeta'] ) && is_string( $field['saveInMeta'] ) ) {
			update_post_meta( $post_id, $field['saveInMeta'], wp_slash( defb_sanitize_value( $value, $field ) ) );
		}

		if ( $can_save && ! empty( $field['saveCallback'] ) && is_callable( $field['saveCallback'] ) ) {
			call_user_func( $field['saveCallback'], $value, $post_id, $key );
		}

		$type = $field['type'] ?? '';
		if ( $type === 'group' ) {
			$nested_fields = isset( $field['fields'] ) && is_array( $field['fields'] ) ? $field['fields'] : [];
			defb_run_field_map_saves( $nested_fields, $values, $post_id, $root_values, $is_visible && $can_save, $can_save );
		} elseif ( $type === 'tabpanels' ) {
			$tabs = isset( $field['tabs'] ) && is_array( $field['tabs'] ) ? $field['tabs'] : [];
			foreach ( $tabs as $tab ) {
				$nested_fields = isset( $tab['fields'] ) && is_array( $tab['fields'] ) ? $tab['fields'] : [];
				defb_run_field_map_saves( $nested_fields, $values, $post_id, $root_values, $is_visible && $can_save, $can_save );
			}
		}
	}
}

function defb_validate_field_for_save(
	mixed $value,
	array $field,
	string|int $key,
	int $post_id,
	array $root_values = [],
): bool|string {
	if ( ! empty( $field['validate'] ) && is_callable( $field['validate'] ) ) {
		return call_user_func( $field['validate'], $value, $key, $post_id );
	}

	$rules   = defb_field_validation_rules( $field );
	$message = isset( $rules['message'] ) && is_string( $rules['message'] ) ? $rules['message'] : false;

	if ( ! empty( $rules['required'] ) && defb_is_empty_value( $value ) ) {
		return $message;
	}

	if ( defb_is_collection_field( $field ) ) {
		$items = is_array( $value ) ? array_values( $value ) : [];

		if ( isset( $rules['min'] ) && count( $items ) < (int) $rules['min'] ) {
			return $message;
		}
		if ( isset( $rules['max'] ) && count( $items ) > (int) $rules['max'] ) {
			return $message;
		}

		return ( $field['type'] ?? '' ) === 'repeater'
			? defb_validate_repeater_items( $items, $field, $post_id, $root_values )
			: true;
	}

	if ( empty( $rules ) ) {
		return true;
	}

	if ( empty( $rules['required'] ) && defb_is_empty_value( $value ) ) {
		return true;
	}

	if ( is_string( $value ) ) {
		$length = defb_string_length( $value );
		if ( isset( $rules['minLength'] ) && $length < (int) $rules['minLength'] ) {
			return $message;
		}
		if ( isset( $rules['maxLength'] ) && $length > (int) $rules['maxLength'] ) {
			return $message;
		}
		if ( ! empty( $rules['pattern'] ) && ! defb_value_matches_pattern( $value, (string) $rules['pattern'] ) ) {
			return $message;
		}
	}

	if ( is_numeric( $value ) ) {
		$numeric_value = (float) $value;
		if ( isset( $rules['min'] ) && $numeric_value < (float) $rules['min'] ) {
			return $message;
		}
		if ( isset( $rules['max'] ) && $numeric_value > (float) $rules['max'] ) {
			return $message;
		}
	}

	return true;
}

function defb_is_collection_field( array $field ): bool {
	return in_array(
		$field['type'] ?? '',
		[ 'repeater', 'gallery', 'post-selector', 'multi-select', 'multi-autocomplete', 'chips', 'taxonomy' ],
		true,
	);
}

function defb_validate_repeater_items( array $items, array $field, int $post_id, array $root_values ): bool|string {
	$fields = isset( $field['fields'] ) && is_array( $field['fields'] ) ? $field['fields'] : [];

	foreach ( $items as $index => $item ) {
		if ( ! is_array( $item ) ) {
			return false;
		}

		$condition_values           = $item;
		$condition_values['$index'] = $index;
		$condition_values['root']   = $root_values;
		$result                     = defb_validate_nested_fields( $fields, $item, $condition_values, $post_id, $root_values );
		if ( $result === false || is_string( $result ) ) {
			return $result;
		}
	}

	return true;
}

function defb_validate_nested_fields(
	array $fields,
	array $values,
	array $condition_values,
	int $post_id,
	array $root_values,
): bool|string {
	foreach ( $fields as $key => $field ) {
		if ( ! is_array( $field ) || ! defb_field_is_visible_for_save( $field, $condition_values ) ) {
			continue;
		}

		$type = $field['type'] ?? '';

		if ( $type === 'group' ) {
			$nested_fields = isset( $field['fields'] ) && is_array( $field['fields'] ) ? $field['fields'] : [];
			$result        = defb_validate_nested_fields( $nested_fields, $values, $condition_values, $post_id, $root_values );
			if ( $result === false || is_string( $result ) ) {
				return $result;
			}
			continue;
		}

		if ( $type === 'tabpanels' ) {
			$tabs = isset( $field['tabs'] ) && is_array( $field['tabs'] ) ? $field['tabs'] : [];
			foreach ( $tabs as $tab ) {
				$nested_fields = isset( $tab['fields'] ) && is_array( $tab['fields'] ) ? $tab['fields'] : [];
				$result        = defb_validate_nested_fields( $nested_fields, $values, $condition_values, $post_id, $root_values );
				if ( $result === false || is_string( $result ) ) {
					return $result;
				}
			}
			continue;
		}

		$value  = array_key_exists( $key, $values ) ? $values[ $key ] : ( $field['default'] ?? null );
		$result = defb_validate_field_for_save( $value, $field, $key, $post_id, $root_values );

		if ( $result === false || is_string( $result ) ) {
			return $result;
		}
	}

	return true;
}

function defb_string_length( string $value ): int {
	if ( function_exists( 'mb_strlen' ) ) {
		return mb_strlen( $value, 'UTF-8' );
	}

	$length = preg_match_all( '/./us', $value );
	return $length === false ? strlen( $value ) : $length;
}

function defb_field_validation_rules( array $field ): array {
	$rules = isset( $field['validate'] ) && is_array( $field['validate'] ) ? $field['validate'] : [];

	foreach ( [ 'required', 'pattern', 'minLength', 'maxLength', 'min', 'max', 'message' ] as $rule ) {
		if ( array_key_exists( $rule, $field ) ) {
			$rules[ $rule ] = $field[ $rule ];
		}
	}

	return $rules;
}

function defb_is_empty_value( mixed $value ): bool {
	if ( $value === null || $value === '' ) {
		return true;
	}
	if ( is_array( $value ) ) {
		if ( array_is_list( $value ) ) {
			return $value === [];
		}
		foreach ( $value as $item ) {
			if ( $item !== '' && $item !== null && $item !== false ) {
				return false;
			}
		}
		return true;
	}
	return false;
}

function defb_value_matches_pattern( string $value, string $pattern ): bool {
	if ( $pattern === '' ) {
		return true;
	}

	if ( $pattern[0] !== '/' ) {
		$pattern = '/' . str_replace( '/', '\/', $pattern ) . '/';
	} elseif ( preg_match( '/^\/(.+)\/([a-z]*)$/', $pattern, $matches ) ) {
		$flags   = preg_replace( '/[^imsuxADUJS]/', '', $matches[2] );
		$pattern = '/' . $matches[1] . '/' . $flags;
	}

	$result = @preg_match( $pattern, $value );
	return $result === false ? true : $result === 1;
}

// ── Includes ───────────────────────────────────────────────────────

require_once plugin_dir_path( __FILE__ ) . 'includes/constants.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/conditions.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/register.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/render.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/enqueue.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/api.php';
require_once plugin_dir_path( __FILE__ ) . 'includes/extend.php';
