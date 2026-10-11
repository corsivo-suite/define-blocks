<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function defb_is_numeric_field( array $field ): bool {
	return ( $field['type'] ?? '' ) === 'range' || ( $field['originalType'] ?? '' ) === 'number';
}

function defb_hydrate_values( array $values, array $schema ): array {
	foreach ( defb_schema_field_sets( $schema ) as $fields ) {
		$values = defb_hydrate_field_values( $values, $fields );
	}

	return $values;
}

function defb_hydrate_field_values( array $values, array $fields ): array {
	foreach ( $fields as $key => $field ) {
		if ( ! is_array( $field ) ) {
			continue;
		}

		if ( ! array_key_exists( $key, $values ) && array_key_exists( 'default', $field ) ) {
			$values[ $key ] = $field['default'];
		}

		$type = $field['type'] ?? '';
		$nested_fields = is_array( $field['fields'] ?? null ) ? $field['fields'] : [];
		if ( $type === 'group' ) {
			$values = defb_hydrate_field_values( $values, $nested_fields );
		} elseif ( $type === 'tabpanels' ) {
			foreach ( is_array( $field['tabs'] ?? null ) ? $field['tabs'] : [] as $tab ) {
				$values = defb_hydrate_field_values( $values, is_array( $tab['fields'] ?? null ) ? $tab['fields'] : [] );
			}
		} elseif ( $type === 'repeater' && isset( $values[ $key ] ) && is_array( $values[ $key ] ) ) {
			foreach ( $values[ $key ] as $index => $item ) {
				if ( is_array( $item ) ) {
					$values[ $key ][ $index ] = defb_hydrate_field_values( $item, $nested_fields );
				}
			}
		} elseif ( defb_is_numeric_field( $field ) && isset( $values[ $key ] ) && is_numeric( $values[ $key ] ) && is_finite( (float) $values[ $key ] ) ) {
			$values[ $key ] += 0;
		}
	}

	return $values;
}

function defb_invalid_field_value(): WP_Error {
	return new WP_Error( 'defb_invalid_field_value', __( 'The field value has an invalid format.', 'define-blocks' ), [ 'status' => 400 ] );
}

function defb_normalize_field_value( mixed $value, array $field, bool $hydrate = true ): mixed {
	if ( $value === null ) {
		return null;
	}

	$type = $field['type'] ?? 'text';
	$custom_sanitizer = defb_get_custom_field_sanitizer( $type );
	if ( $custom_sanitizer ) {
		return $custom_sanitizer( $value, $field );
	}

	if ( defb_is_numeric_field( $field ) ) {
		if ( $value === '' ) {
			return '';
		}
		return is_numeric( $value ) && is_finite( (float) $value ) ? $value + 0 : defb_invalid_field_value();
	}

	if ( $type === 'checkbox' || $type === 'toolbar-toggle' ) {
		return match ( $value ) {
			true, 1, '1', 'true' => true,
			false, 0, '0', 'false', '' => false,
			default => defb_invalid_field_value(),
		};
	}

	if ( $type === 'repeater' ) {
		if ( ! is_array( $value ) || ! array_is_list( $value ) ) {
			return defb_invalid_field_value();
		}
		$fields = is_array( $field['fields'] ?? null ) ? $field['fields'] : [];
		$normalized = [];
		foreach ( $value as $item ) {
			if ( ! is_array( $item ) ) {
				return defb_invalid_field_value();
			}
			$row = defb_normalize_field_values( $hydrate ? defb_hydrate_field_values( $item, $fields ) : $item, defb_flatten_fields( $fields ), $hydrate );
			if ( is_wp_error( $row ) ) {
				return $row;
			}
			$normalized[] = $row;
		}
		return $normalized;
	}

	$selection_types = [ 'multi-select', 'multi-autocomplete', 'chips', 'taxonomy' ];
	if ( in_array( $type, [ ...$selection_types, 'gallery', 'post-selector' ], true ) ) {
		if ( ! is_array( $value ) || ! array_is_list( $value ) ) {
			return defb_invalid_field_value();
		}
		$normalized = [];
		foreach ( $value as $item ) {
			if ( in_array( $type, $selection_types, true ) && ( is_string( $item ) || is_int( $item ) || is_float( $item ) ) ) {
				$item = [ 'value' => (string) $item, 'label' => (string) $item ];
			}
			if ( ! is_array( $item ) || ! defb_object_value_has_valid_shape( $item ) ) {
				return defb_invalid_field_value();
			}
			if ( in_array( $type, $selection_types, true ) ) {
				if ( ! array_key_exists( 'value', $item ) ) {
					return defb_invalid_field_value();
				}
				$item['value'] = (string) $item['value'];
				$item['label'] = (string) ( $item['label'] ?? $item['value'] );
			} elseif ( ! isset( $item['id'] ) && ! isset( $item['url'] ) ) {
				return defb_invalid_field_value();
			}
			$normalized[] = $item;
		}
		return defb_sanitize_value( $normalized, $field );
	}

	$object_types = [ 'media', 'file', 'link', 'google-map', 'osm-map', 'mapbox-map', 'google-geocoder', 'mapbox-geocoder', 'osm-geocoder' ];
	if ( in_array( $type, $object_types, true ) ) {
		if ( is_string( $value ) && $value !== '' ) {
			$value = json_decode( $value, true );
			if ( $value === null ) {
				return defb_invalid_field_value();
			}
		}
		if ( $value === '' ) {
			$value = [];
		}
		return is_array( $value ) && defb_object_value_has_valid_shape( $value )
			? defb_sanitize_value( $value, $field )
			: defb_invalid_field_value();
	}

	$text_types = [ 'text', 'text-with-parser', 'select', 'autocomplete', 'textarea', 'richtext', 'color', 'url', 'video', 'date', 'time', 'datetime', 'toolbar-select', 'toolbar-input', 'toolbar-autocomplete' ];
	if ( in_array( $type, [ 'select', 'autocomplete', 'toolbar-select', 'toolbar-autocomplete' ], true ) && ( is_int( $value ) || is_float( $value ) ) ) {
		$value = (string) $value;
	}
	if ( in_array( $type, $text_types, true ) && ! is_string( $value ) ) {
		return defb_invalid_field_value();
	}

	return defb_sanitize_value( $value, $field );
}

function defb_object_value_has_valid_shape( array $value ): bool {
	if ( $value !== [] && array_is_list( $value ) ) {
		return false;
	}
	foreach ( [ 'id', 'url', 'alt', 'title', 'name', 'size', 'mime', 'opensInNewTab', 'lat', 'lng', 'latitude', 'longitude', 'formatted_address', 'address', 'query', 'permalink', 'thumbnail', 'value', 'label' ] as $key ) {
		if ( array_key_exists( $key, $value ) && ! is_scalar( $value[ $key ] ) && $value[ $key ] !== null ) {
			return false;
		}
	}
	foreach ( [ 'id', 'lat', 'lng', 'latitude', 'longitude' ] as $key ) {
		if ( isset( $value[ $key ] ) && $value[ $key ] !== '' && ( ! is_numeric( $value[ $key ] ) || ! is_finite( (float) $value[ $key ] ) ) ) {
			return false;
		}
	}
	return true;
}

function defb_normalize_field_values( array $values, array $fields, bool $hydrate = true ): array|WP_Error {
	$normalized = [];
	foreach ( $values as $key => $value ) {
		$normalized[ $key ] = isset( $fields[ $key ] )
			? defb_normalize_field_value( $value, $fields[ $key ], $hydrate )
			: defb_sanitize_deep( $value );
		if ( is_wp_error( $normalized[ $key ] ) ) {
			return $normalized[ $key ];
		}
	}
	return $normalized;
}

function defb_user_can_save_meta( int $post_id, string $meta_key, bool $programmatic = false ): bool {
	return ( $programmatic && ! get_current_user_id() ) || current_user_can( 'edit_post_meta', $post_id, $meta_key );
}
