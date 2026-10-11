<?php

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

function defb_evaluate_condition( mixed $condition, array $values ): bool {
	if ( ! $condition ) {
		return true;
	}

	if ( is_string( $condition ) ) {
		try {
			$tokens   = defb_tokenize_condition( $condition );
			$position = 0;
			$result   = defb_parse_condition_expression( $tokens, $position, $values );

			if ( $position !== count( $tokens ) ) {
				throw new InvalidArgumentException();
			}

			return defb_condition_to_boolean( $result );
		} catch ( Throwable ) {
			return true;
		}
	}

	if ( ! is_array( $condition ) ) {
		return true;
	}

	$entries = array_filter(
		$condition,
		static fn( string|int $key ): bool => $key !== 'relation',
		ARRAY_FILTER_USE_KEY,
	);

	if ( empty( $entries ) ) {
		return true;
	}

	$results = [];
	foreach ( $entries as $path => $expected ) {
		$actual = defb_resolve_condition_value( $values, (string) $path );

		if ( is_array( $expected ) && ! array_is_list( $expected ) ) {
			$results[] = defb_evaluate_condition_comparison( $actual, $expected );
		} elseif ( is_array( $expected ) ) {
			$results[] = defb_condition_array_contains( $expected, $actual );
		} else {
			$results[] = defb_condition_values_equal( $actual, $expected );
		}
	}

	$relation = strtoupper( (string) ( $condition['relation'] ?? 'AND' ) );
	$matches  = count( array_filter( $results ) );

	return match ( $relation ) {
		'OR'   => $matches > 0,
		'XOR'  => $matches === 1,
		'NAND' => $matches !== count( $results ),
		'NOR'  => $matches === 0,
		default => $matches === count( $results ),
	};
}

function defb_field_is_visible_for_save( array $field, array $values ): bool {
	if ( ( $field['visible'] ?? true ) === false ) {
		return false;
	}

	if ( ! empty( $field['condition'] ) && ! defb_evaluate_condition( $field['condition'], $values ) ) {
		return false;
	}

	return empty( $field['conditionHide'] ) || ! defb_evaluate_condition( $field['conditionHide'], $values );
}

function defb_resolve_condition_value( array $values, string $path ): mixed {
	$current = $values;

	foreach ( explode( '.', $path ) as $part ) {
		if ( ! is_array( $current ) || ! array_key_exists( $part, $current ) ) {
			return defb_condition_undefined();
		}
		$current = $current[ $part ];
	}

	return $current;
}

function defb_condition_undefined(): object {
	static $undefined;
	return $undefined ??= new stdClass();
}

function defb_evaluate_condition_comparison( mixed $actual, array $rule ): bool {
	$value    = array_key_exists( 'value', $rule ) ? $rule['value'] : defb_condition_undefined();
	$operator = $rule['operator'] ?? '===';

	return match ( $operator ) {
		'===', '==' => defb_condition_values_equal( $actual, $value ),
		'!==', '!=' => ! defb_condition_values_equal( $actual, $value ),
		'>', '<', '>=', '<=' => defb_condition_values_compare( $actual, $value, $operator ),
		'in'         => is_array( $value ) && defb_condition_array_contains( $value, $actual ),
		'contains'   => is_string( $actual ) && is_string( $value ) && str_contains( $actual, $value ),
		'empty'      => defb_condition_value_is_empty( $actual ),
		'!empty'     => ! defb_condition_value_is_empty( $actual ),
		default      => defb_condition_values_equal( $actual, $value ),
	};
}

function defb_condition_values_compare( mixed $left, mixed $right, string $operator ): bool {
	$left  = defb_condition_to_primitive( $left );
	$right = defb_condition_to_primitive( $right );

	if ( is_string( $left ) && is_string( $right ) ) {
		$comparison = strcmp( $left, $right );
		$left       = $comparison;
		$right      = 0;
	} else {
		$left  = defb_condition_to_number( $left );
		$right = defb_condition_to_number( $right );
	}

	return match ( $operator ) {
		'>'  => $left > $right,
		'<'  => $left < $right,
		'>=' => $left >= $right,
		'<=' => $left <= $right,
	};
}

function defb_condition_to_primitive( mixed $value ): mixed {
	if ( ! is_array( $value ) ) {
		return $value;
	}
	if ( ! array_is_list( $value ) ) {
		return '[object Object]';
	}

	return implode( ',', array_map( static function ( mixed $item ): string {
		if ( $item === null || $item === defb_condition_undefined() ) {
			return '';
		}
		if ( is_bool( $item ) ) {
			return $item ? 'true' : 'false';
		}
		return (string) defb_condition_to_primitive( $item );
	}, $value ) );
}

function defb_condition_to_number( mixed $value ): float {
	$value = defb_condition_to_primitive( $value );
	if ( $value === null || is_bool( $value ) || is_int( $value ) || is_float( $value ) ) {
		return (float) $value;
	}
	if ( ! is_string( $value ) ) {
		return NAN;
	}

	$value = preg_replace( '/^[\s\x{FEFF}]+|[\s\x{FEFF}]+$/u', '', $value ) ?? $value;
	if ( $value === '' ) {
		return 0.0;
	}
	if ( in_array( $value, [ 'Infinity', '+Infinity', '-Infinity' ], true ) ) {
		return $value === '-Infinity' ? -INF : INF;
	}
	foreach ( [ 16 => '/^0x[0-9a-f]+$/i', 8 => '/^0o[0-7]+$/i', 2 => '/^0b[01]+$/i' ] as $base => $pattern ) {
		if ( preg_match( $pattern, $value ) ) {
			return (float) base_convert( substr( $value, 2 ), $base, 10 );
		}
	}

	return is_numeric( $value ) ? (float) $value : NAN;
}

function defb_condition_value_is_empty( mixed $value ): bool {
	return $value === defb_condition_undefined() || defb_is_empty_value( $value );
}

function defb_condition_values_equal( mixed $left, mixed $right ): bool {
	if ( ( is_int( $left ) || is_float( $left ) ) && ( is_int( $right ) || is_float( $right ) ) ) {
		return (float) $left === (float) $right;
	}

	return $left === $right;
}

function defb_condition_to_boolean( mixed $value ): bool {
	if ( is_array( $value ) ) {
		return true;
	}

	if ( $value === defb_condition_undefined() || $value === null || $value === false || $value === '' || $value === 0 || $value === 0.0 ) {
		return false;
	}

	return ! is_float( $value ) || ! is_nan( $value );
}

function defb_condition_array_contains( array $values, mixed $expected ): bool {
	foreach ( $values as $value ) {
		if ( defb_condition_values_equal( $value, $expected ) ) {
			return true;
		}
	}

	return false;
}

function defb_tokenize_condition( string $source ): array {
	$tokens = [];
	$index  = 0;
	$length = strlen( $source );

	while ( $index < $length ) {
		$character = $source[ $index ];

		if ( ctype_space( $character ) ) {
			$index++;
			continue;
		}

		if ( $character === '"' || $character === "'" ) {
			$quote = $character;
			$value = '';
			$index++;

			while ( $index < $length && $source[ $index ] !== $quote ) {
				if ( $source[ $index ] === '\\' ) {
					$index++;
				}
				$value .= $source[ $index ] ?? '';
				$index++;
			}

			if ( $index >= $length ) {
				throw new InvalidArgumentException();
			}

			$index++;
			$tokens[] = [ 'type' => 'string', 'value' => $value ];
			continue;
		}

		if ( ctype_digit( $character ) ) {
			$value = '';
			while ( $index < $length && ( ctype_digit( $source[ $index ] ) || $source[ $index ] === '.' ) ) {
				$value .= $source[ $index ];
				$index++;
			}

			if ( ! is_numeric( $value ) ) {
				throw new InvalidArgumentException();
			}

			$tokens[] = [ 'type' => 'number', 'value' => (float) $value ];
			continue;
		}

		$three_characters = substr( $source, $index, 3 );
		$two_characters   = substr( $source, $index, 2 );

		if ( in_array( $three_characters, [ '===', '!==' ], true ) ) {
			$tokens[] = [ 'type' => 'operator', 'value' => $three_characters ];
			$index   += 3;
			continue;
		}

		if ( in_array( $two_characters, [ '==', '!=', '>=', '<=', '&&', '||', '!!' ], true ) ) {
			$tokens[] = [ 'type' => 'operator', 'value' => $two_characters ];
			$index   += 2;
			continue;
		}

		if ( str_contains( '><-!', $character ) ) {
			$tokens[] = [ 'type' => 'operator', 'value' => $character ];
			$index++;
			continue;
		}

		if ( str_contains( '()[],.', $character ) ) {
			$tokens[] = [ 'type' => $character ];
			$index++;
			continue;
		}

		if ( preg_match( '/[a-zA-Z_$]/', $character ) ) {
			$value = '';
			while ( $index < $length ) {
				$current = $source[ $index ];
				$next    = $source[ $index + 1 ] ?? '';
				if ( ! preg_match( '/[a-zA-Z0-9_$]/', $current ) && ! ( $current === '-' && preg_match( '/[a-zA-Z0-9_$]/', $next ) ) ) {
					break;
				}
				$value .= $current;
				$index++;
			}

			if ( $value === 'true' || $value === 'false' ) {
				$tokens[] = [ 'type' => 'boolean', 'value' => $value === 'true' ];
			} elseif ( $value === 'null' || $value === 'undefined' ) {
				$tokens[] = [ 'type' => 'null', 'value' => null ];
			} elseif ( in_array( $value, [ 'empty', 'in', 'contains' ], true ) ) {
				$tokens[] = [ 'type' => 'operator', 'value' => $value ];
			} else {
				$tokens[] = [ 'type' => 'identifier', 'value' => $value ];
			}
			continue;
		}

		throw new InvalidArgumentException();
	}

	return $tokens;
}

function defb_parse_condition_expression( array $tokens, int &$position, array $values ): mixed {
	return defb_parse_condition_or( $tokens, $position, $values );
}

function defb_parse_condition_or( array $tokens, int &$position, array $values ): mixed {
	$result = defb_parse_condition_and( $tokens, $position, $values );

	while ( defb_condition_token_matches( $tokens, $position, 'operator', '||' ) ) {
		$position++;
		$right  = defb_parse_condition_and( $tokens, $position, $values );
		$result = defb_condition_to_boolean( $result ) ? $result : $right;
	}

	return $result;
}

function defb_parse_condition_and( array $tokens, int &$position, array $values ): mixed {
	$result = defb_parse_condition_comparison( $tokens, $position, $values );

	while ( defb_condition_token_matches( $tokens, $position, 'operator', '&&' ) ) {
		$position++;
		$right  = defb_parse_condition_comparison( $tokens, $position, $values );
		$result = defb_condition_to_boolean( $result ) ? $right : $result;
	}

	return $result;
}

function defb_parse_condition_comparison( array $tokens, int &$position, array $values ): mixed {
	$left  = defb_parse_condition_postfix( $tokens, $position, $values );
	$token = $tokens[ $position ] ?? null;

	if ( ! is_array( $token ) || ( $token['type'] ?? '' ) !== 'operator' ) {
		return $left;
	}

	$operator = $token['value'];

	if ( in_array( $operator, [ '===', '!==', '==', '!=', '>', '<', '>=', '<=' ], true ) ) {
		$position++;
		$right = defb_parse_condition_postfix( $tokens, $position, $values );
		return defb_evaluate_condition_comparison( $left, [ 'operator' => $operator, 'value' => $right ] );
	}

	if ( $operator === 'empty' ) {
		$position++;
		return defb_condition_value_is_empty( $left );
	}

	if (
		$operator === '!' &&
		defb_condition_token_matches( $tokens, $position + 1, 'operator', 'empty' )
	) {
		$position += 2;
		return ! defb_condition_value_is_empty( $left );
	}

	if ( $operator === 'in' || $operator === 'contains' ) {
		$position++;
		$right = defb_parse_condition_postfix( $tokens, $position, $values );

		if ( $operator === 'in' ) {
			return is_array( $right ) && defb_condition_array_contains( $right, $left );
		}

		return is_array( $left )
			? defb_condition_array_contains( $left, $right )
			: is_string( $left ) && is_string( $right ) && str_contains( $left, $right );
	}

	return $left;
}

function defb_parse_condition_postfix( array $tokens, int &$position, array $values ): mixed {
	$result = defb_parse_condition_unary( $tokens, $position, $values );

	while ( defb_condition_token_matches( $tokens, $position, '.' ) ) {
		$position++;
		$method = $tokens[ $position ] ?? null;
		if ( ( $method['type'] ?? '' ) !== 'identifier' || ( $method['value'] ?? '' ) !== 'includes' ) {
			throw new InvalidArgumentException();
		}
		$position++;
		defb_expect_condition_token( $tokens, $position, '(' );
		$argument = defb_parse_condition_expression( $tokens, $position, $values );
		defb_expect_condition_token( $tokens, $position, ')' );

		$result = is_array( $result )
			? defb_condition_array_contains( $result, $argument )
			: is_string( $result ) && is_string( $argument ) && str_contains( $result, $argument );
	}

	return $result;
}

function defb_parse_condition_unary( array $tokens, int &$position, array $values ): mixed {
	if ( defb_condition_token_matches( $tokens, $position, 'operator', '!!' ) ) {
		$position++;
		return defb_condition_to_boolean( defb_parse_condition_primary( $tokens, $position, $values ) );
	}

	if ( defb_condition_token_matches( $tokens, $position, 'operator', '!' ) ) {
		$position++;
		return ! defb_condition_to_boolean( defb_parse_condition_unary( $tokens, $position, $values ) );
	}

	if ( defb_condition_token_matches( $tokens, $position, 'operator', '-' ) ) {
		$position++;
		return -defb_condition_to_number( defb_parse_condition_primary( $tokens, $position, $values ) );
	}

	return defb_parse_condition_primary( $tokens, $position, $values );
}

function defb_parse_condition_primary( array $tokens, int &$position, array $values ): mixed {
	$token = $tokens[ $position ] ?? null;
	if ( ! is_array( $token ) ) {
		throw new InvalidArgumentException();
	}

	if ( $token['type'] === '(' ) {
		$position++;
		$result = defb_parse_condition_expression( $tokens, $position, $values );
		defb_expect_condition_token( $tokens, $position, ')' );
		return $result;
	}

	if ( $token['type'] === '[' ) {
		$position++;
		$items = [];
		while ( ! defb_condition_token_matches( $tokens, $position, ']' ) ) {
			$items[] = defb_parse_condition_expression( $tokens, $position, $values );
			if ( defb_condition_token_matches( $tokens, $position, ',' ) ) {
				$position++;
			}
		}
		$position++;
		return $items;
	}

	if ( in_array( $token['type'], [ 'string', 'number', 'boolean', 'null' ], true ) ) {
		$position++;
		return $token['value'];
	}

	if ( $token['type'] === 'identifier' ) {
		$position++;
		$path = $token['value'];

		while (
			defb_condition_token_matches( $tokens, $position, '.' ) &&
			( $tokens[ $position + 1 ]['type'] ?? '' ) === 'identifier' &&
			( $tokens[ $position + 1 ]['value'] ?? '' ) !== 'includes'
		) {
			$position++;
			$path .= '.' . $tokens[ $position ]['value'];
			$position++;
		}

		return defb_resolve_condition_value( $values, $path );
	}

	throw new InvalidArgumentException();
}

function defb_condition_token_matches( array $tokens, int $position, string $type, ?string $value = null ): bool {
	$token = $tokens[ $position ] ?? null;
	return is_array( $token ) &&
		( $token['type'] ?? '' ) === $type &&
		( $value === null || ( $token['value'] ?? null ) === $value );
}

function defb_expect_condition_token( array $tokens, int &$position, string $type ): void {
	if ( ! defb_condition_token_matches( $tokens, $position, $type ) ) {
		throw new InvalidArgumentException();
	}
	$position++;
}
