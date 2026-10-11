<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function defb_schema_warning( string $block_name, string $path, string $message ): void {
	static $reported = [];
	if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
		return;
	}
	$description = $block_name . ' → ' . $path . ': ' . $message;
	if ( isset( $reported[ $description ] ) ) {
		return;
	}
	$reported[ $description ] = true;
	_doing_it_wrong( 'define_block_type', esc_html( $description ), '1.1.0' );
}

function defb_check_block_schema( array $block ): void {
	if ( ! defined( 'WP_DEBUG' ) || ! WP_DEBUG ) {
		return;
	}
	foreach ( defb_schema_diagnostics( $block ) as $diagnostic ) {
		defb_schema_warning( $block['name'] ?? '(unnamed)', $diagnostic['path'], $diagnostic['message'] );
	}
}

function defb_builtin_field_types(): array {
	return explode( ' ', 'text text-with-parser textarea richtext select multi-select autocomplete multi-autocomplete checkbox color range url link media file gallery video hidden title value group innerblocks time date datetime chips repeater tabpanels post-selector taxonomy google-map osm-map mapbox-map google-geocoder mapbox-geocoder osm-geocoder toolbar-toggle toolbar-select toolbar-dropdown toolbar-input toolbar-autocomplete' );
}

function defb_schema_diagnostics( array $block ): array {
	$diagnostics = [];
	$report = static function ( string $path, string $message ) use ( &$diagnostics ): void {
		$diagnostics[] = [ 'path' => $path, 'message' => $message ];
	};
	$block_keys = explode( ' ', 'name title description icon category keywords supports settings schema render wrapperClass frontend_preview parent ancestor usesContext providesContext _schema _defaults' );
	foreach ( array_keys( $block ) as $key ) {
		if ( ! in_array( $key, $block_keys, true ) && ! str_starts_with( (string) $key, '_' ) ) {
			$report( (string) $key, 'Unknown block property.' );
		}
	}
	foreach ( [ 'supports', 'settings' ] as $key ) {
		if ( isset( $block[ $key ] ) && ! is_array( $block[ $key ] ) ) {
			$report( $key, 'Expected a configuration array.' );
		}
	}
	foreach ( [ 'parent', 'ancestor', 'usesContext' ] as $key ) {
		if ( isset( $block[ $key ] ) && ( ! is_array( $block[ $key ] ) || ! array_is_list( $block[ $key ] ) || count( array_filter( $block[ $key ], 'is_string' ) ) !== count( $block[ $key ] ) ) ) {
			$report( $key, 'Expected a list of strings.' );
		}
	}
	if ( isset( $block['providesContext'] ) ) {
		if ( ! is_array( $block['providesContext'] ) ) {
			$report( 'providesContext', 'Expected context-name => attribute-name pairs.' );
		} else {
			foreach ( $block['providesContext'] as $context => $attribute ) {
				if ( ! is_string( $context ) || $context === '' || ! is_string( $attribute ) || $attribute === '' || str_contains( $attribute, '.' ) ) {
					$report( 'providesContext.' . $context, 'Map to a top-level attribute name, such as values. Nested field paths are not supported by WordPress.' );
				}
			}
		}
	}
	$schema = $block['schema'] ?? [];
	if ( ! is_array( $schema ) ) {
		$report( 'schema', 'Expected an array.' );
		return $diagnostics;
	}
	$field_sets = [];
	if ( ! array_is_list( $schema ) ) {
		$field_sets[] = [ $schema, 'schema' ];
	} else {
		foreach ( $schema as $index => $entry ) {
			$path = 'schema.' . $index;
			if ( ! is_array( $entry ) || ! in_array( $entry['scope'] ?? '', [ 'content', 'inspector', 'inspector-advanced', 'toolbar', 'toolbar-dropdown' ], true ) ) {
				$report( $path, 'Expected a supported scope and a fields array.' );
				continue;
			}
			$field_sets[] = [ $entry['fields'] ?? [], $path . '.fields' ];
		}
	}
	$known_types = array_merge( defb_builtin_field_types(), array_keys( $GLOBALS['defb_custom_field_sanitizers'] ?? [] ), $GLOBALS['defb_custom_field_types'] ?? [] );
	$known_types = apply_filters( 'defb_schema_field_types', $known_types );
	$properties = explode( ' ', 'name type originalType label title icon default description placeholder width style visible condition conditionHide show hide saveInMeta persistAs validate saveCallback required pattern minLength maxLength min max message options step clearable disableCustomColors enableAlpha allowedTypes buttonLabel focus draggable inline addLabel previewKey fields tabs postType taxonomy allowCreate createLabel restBase restNamespace tagName allowedFormats rows parser sanitized allowedBlocks template templateLock orientation includeSeconds startOfWeek titlePlaceholder language geocodingOptions reverseGeocodingOptions loaderOptions mapOptions mapId zoom height styleUrl tileUrl attribution searchEndpoint reverseEndpoint' );
	$properties = apply_filters( 'defb_schema_field_properties', $properties, $block );
	$seen = [];
	$innerblocks = [];
	$references = [];
	$walk = static function ( mixed $fields, string $path, string $storage, bool $in_repeater ) use ( &$walk, &$seen, &$innerblocks, &$references, $known_types, $properties, $report ): void {
		if ( ! is_array( $fields ) ) {
			$report( $path, 'Expected a fields array.' );
			return;
		}
		foreach ( $fields as $key => $raw ) {
			$field_path = $path . '.' . $key;
			if ( ! is_array( $raw ) ) {
				$report( $field_path, 'Expected a field configuration array.' );
				continue;
			}
			$name = is_string( $key ) ? $key : ( $raw['name'] ?? null );
			if ( ! is_string( $name ) || $name === '' ) {
				$report( $field_path, 'A field name is required.' );
				continue;
			}
			$field = defb_prepare_field( $raw );
			$type = $field['type'] ?? null;
			if ( ! is_string( $type ) || $type === '' ) {
				$report( $field_path . '.type', 'A field type is required.' );
			} elseif ( ! in_array( $type, $known_types, true ) && empty( $GLOBALS['defb_untyped_custom_fields'] ) ) {
				$report( $field_path . '.type', 'Unknown field type: ' . $type . '.' );
			}
			if ( in_array( $type, defb_builtin_field_types(), true ) ) {
				foreach ( array_keys( $raw ) as $property ) {
					if ( ! in_array( $property, $properties, true ) && ! str_starts_with( (string) $property, '_' ) ) {
						$report( $field_path . '.' . $property, 'Unknown field property.' );
					}
				}
			}
			if ( ! in_array( $type, [ 'group', 'tabpanels', 'title', 'innerblocks' ], true ) ) {
				if ( isset( $seen[ $storage ][ $name ] ) ) {
					$report( $field_path, 'Duplicate value name; already declared at ' . $seen[ $storage ][ $name ] . '.' );
				}
				$seen[ $storage ][ $name ] = $field_path;
			}
			foreach ( [ 'condition', 'conditionHide' ] as $condition_key ) {
				if ( array_key_exists( $condition_key, $field ) ) {
					$references[] = [ $field[ $condition_key ], $field_path . '.' . $condition_key, $storage ];
				}
			}
			if ( $type === 'innerblocks' ) {
				$innerblocks[] = $field_path;
				if ( $in_repeater ) {
					$report( $field_path, 'InnerBlocks cannot be placed inside a repeater.' );
				}
			}
			if ( array_key_exists( 'fields', $field ) ) {
				$walk( $raw['fields'], $field_path . '.fields', $type === 'repeater' ? $field_path : $storage, $in_repeater || $type === 'repeater' );
			}
			if ( isset( $raw['tabs'] ) ) {
				if ( ! is_array( $raw['tabs'] ) ) {
					$report( $field_path . '.tabs', 'Expected a tabs array.' );
				}
				foreach ( is_array( $raw['tabs'] ) ? $raw['tabs'] : [] as $tab_key => $tab ) {
					$walk( is_array( $tab ) ? ( $tab['fields'] ?? [] ) : null, $field_path . '.tabs.' . $tab_key . '.fields', $storage, $in_repeater );
				}
			}
		}
	};
	foreach ( $field_sets as [ $fields, $path ] ) {
		$walk( $fields, $path, '', false );
	}
	if ( count( $innerblocks ) > 1 ) {
		$report( $innerblocks[1], 'Only one InnerBlocks area is supported per block.' );
	}
	foreach ( $references as [ $condition, $path, $storage ] ) {
		try {
			$paths = defb_condition_references( $condition );
			foreach ( $paths as $reference ) {
				$parts = explode( '.', $reference );
				$name = $parts[0];
				if ( $name === '$index' && $storage !== '' ) {
					continue;
				}
				$reference_storage = $storage;
				if ( $name === 'root' && $storage !== '' ) {
					$reference_storage = '';
					$name = $parts[1] ?? null;
				}
				if ( $name !== null && ! isset( $seen[ $reference_storage ][ $name ] ) ) {
					$report( $path, 'Unknown field reference: ' . $reference . '.' );
				}
			}
		} catch ( Throwable ) {
			$report( $path, 'Malformed condition.' );
		}
	}
	return $diagnostics;
}

function defb_condition_references( mixed $condition ): array {
	if ( is_array( $condition ) ) {
		if ( ! in_array( strtoupper( (string) ( $condition['relation'] ?? 'AND' ) ), [ 'AND', 'OR', 'XOR', 'NAND', 'NOR' ], true ) ) {
			throw new InvalidArgumentException();
		}
		$paths = [];
		foreach ( $condition as $path => $comparison ) {
			if ( $path === 'relation' ) {
				continue;
			}
			if ( ! is_string( $path ) ) {
				throw new InvalidArgumentException();
			}
			if ( is_array( $comparison ) && ! array_is_list( $comparison ) ) {
				if ( array_diff( array_keys( $comparison ), [ 'operator', 'value' ] ) || ! in_array( $comparison['operator'] ?? '===', [ '===', '==', '!==', '!=', '>', '<', '>=', '<=', 'in', 'contains', 'empty', '!empty' ], true ) ) {
					throw new InvalidArgumentException();
				}
			}
			$paths[] = $path;
		}
		return $paths;
	}
	if ( ! is_string( $condition ) || trim( $condition ) === '' ) {
		throw new InvalidArgumentException();
	}
	$tokens = defb_tokenize_condition( $condition );
	$position = 0;
	defb_parse_condition_expression( $tokens, $position, [] );
	if ( $position !== count( $tokens ) ) {
		throw new InvalidArgumentException();
	}
	$paths = [];
	foreach ( $tokens as $index => $token ) {
		if ( $token['type'] === 'identifier' && ( $tokens[ $index - 1 ]['type'] ?? '' ) !== '.' ) {
			$path = $token['value'];
			$next = $index + 1;
			while ( ( $tokens[ $next ]['type'] ?? '' ) === '.' && ( $tokens[ $next + 1 ]['type'] ?? '' ) === 'identifier' && ( $tokens[ $next + 1 ]['value'] ?? '' ) !== 'includes' ) {
				$path .= '.' . $tokens[ $next + 1 ]['value'];
				$next += 2;
			}
			$paths[] = $path;
		}
	}
	return array_unique( $paths );
}
