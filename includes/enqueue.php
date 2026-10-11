<?php
/**
 * Editor asset enqueuing: scripts, styles, preview CSS, block data.
 *
 * @package DefineBlocks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// ── Editor styles (via enqueue_block_assets for iframe compat) ──────

add_action( 'enqueue_block_assets', static function (): void {
	if ( ! is_admin() ) {
		return;
	}

	$blocks = defb_registered( defb_editor_post_id() );
	if ( empty( $blocks ) ) {
		return;
	}

	$fix_path = DEFB_PATH . 'enqueue/fix.css';
	wp_enqueue_style(
		'defb-editor-fix',
		DEFB_URL . 'enqueue/fix.css',
		[],
		file_exists( $fix_path ) ? (string) filemtime( $fix_path ) : DEFB_VERSION,
	);

	$css_path = DEFB_PATH . 'editor/build/index.css';
	wp_enqueue_style(
		'defb-editor-css',
		DEFB_URL . 'editor/build/index.css',
		[ 'wp-edit-blocks', 'dashicons' ],
		file_exists( $css_path ) ? (string) filemtime( $css_path ) : DEFB_VERSION,
	);
	wp_style_add_data( 'defb-editor-css', 'rtl', 'replace' );
} );

// ── Preview scope styles ────────────────────────────────────────────

add_action( 'enqueue_block_assets', static function (): void {
	if ( ! is_admin() ) {
		return;
	}

	$has_preview = false;
	foreach ( defb_registered( defb_editor_post_id() ) as $block ) {
		if ( ! empty( $block['settings']['frontendPreview'] ) ) {
			$has_preview = true;
			break;
		}
	}

	if ( ! $has_preview ) {
		return;
	}

	$sources = apply_filters( 'defb_preview_style', [] );
	$sources = is_string( $sources ) ? [ $sources ] : $sources;

	if ( empty( $sources ) ) {
		return;
	}

	$css = '';
	foreach ( $sources as $src ) {
		if ( ! is_string( $src ) || $src === '' ) {
			continue;
		}

		if ( ! is_file( $src ) ) {
			$css .= $src . "\n";
			continue;
		}

		$source_css = file_get_contents( $src );
		if ( $source_css === false ) {
			continue;
		}

		$source_url = defb_local_stylesheet_url( $src );
		$css       .= ( $source_url ? defb_rebase_css_urls( $source_css, $source_url ) : $source_css ) . "\n";
	}

	if ( $css ) {
		wp_register_style( 'defb-preview-scope', false, [], DEFB_VERSION );
		wp_enqueue_style( 'defb-preview-scope' );
		wp_add_inline_style( 'defb-preview-scope', defb_scope_preview_css( $css ) );
	}
}, 20 );

function defb_local_stylesheet_url( string $path ): ?string {
	$resolved_path = realpath( $path );
	if ( $resolved_path === false ) {
		return null;
	}

	$normalized_path = wp_normalize_path( $resolved_path );
	$mappings        = [
		[ WP_CONTENT_DIR, content_url() ],
		[ ABSPATH, site_url() ],
	];

	foreach ( $mappings as [ $root_path, $root_url ] ) {
		$resolved_root = realpath( $root_path );
		$normalized_root = trailingslashit( wp_normalize_path( $resolved_root !== false ? $resolved_root : $root_path ) );
		$path_matches    = DIRECTORY_SEPARATOR === '\\'
			? str_starts_with( strtolower( $normalized_path ), strtolower( $normalized_root ) )
			: str_starts_with( $normalized_path, $normalized_root );

		if ( $path_matches ) {
			$relative_path = ltrim( substr( $normalized_path, strlen( $normalized_root ) ), '/' );
			return esc_url_raw( trailingslashit( $root_url ) . $relative_path );
		}
	}

	return null;
}

function defb_rebase_css_urls( string $css, string $source_url ): string {
	$rebased = preg_replace_callback(
		'~url\(\s*(?:(["\'])(.*?)\1|([^)]*))\s*\)~i',
		static function ( array $matches ) use ( $source_url ): string {
			$quote     = $matches[1] ?? '';
			$reference = trim( $quote !== '' ? $matches[2] : ( $matches[3] ?? '' ) );

			if (
				$reference === '' ||
				str_starts_with( $reference, '/' ) ||
				str_starts_with( $reference, '#' ) ||
				str_starts_with( $reference, 'var(' ) ||
				preg_match( '~^[a-z][a-z0-9+.-]*:~i', $reference )
			) {
				return $matches[0];
			}

			$absolute_url = esc_url_raw( WP_Http::make_absolute_url( $reference, $source_url ) );
			if ( $absolute_url === '' ) {
				return $matches[0];
			}

			$quote = $quote ?: '"';
			return 'url(' . $quote . $absolute_url . $quote . ')';
		},
		$css,
	);

	return $rebased ?? $css;
}

function defb_scope_preview_css( string $css, string $scope = '.defb-preview' ): string {
	return defb_scope_css_rules( $css, $scope );
}

function defb_scope_css_rules( string $css, string $scope ): string {
	$out    = '';
	$offset = 0;
	$len    = strlen( $css );

	while ( $offset < $len ) {
		$brace = defb_find_css_delimiter( $css, '{', $offset );
		if ( $brace === false ) {
			$out .= substr( $css, $offset );
			break;
		}

		$end = defb_find_css_block_end( $css, $brace );
		if ( $end === null ) {
			$out .= substr( $css, $offset );
			break;
		}

		$prelude = defb_strip_css_comments( substr( $css, $offset, $brace - $offset ) );
		while ( ( $semicolon = defb_find_css_delimiter( $prelude, ';' ) ) !== false ) {
			$out    .= substr( $prelude, 0, $semicolon + 1 );
			$prelude = substr( $prelude, $semicolon + 1 );
		}

		$leading  = substr( $prelude, 0, strlen( $prelude ) - strlen( ltrim( $prelude ) ) );
		$selector = trim( $prelude );
		$body     = substr( $css, $brace + 1, $end - $brace - 1 );

		if ( $selector === '' ) {
			$out .= $leading . '{' . $body . '}';
		} elseif ( str_starts_with( $selector, '@' ) ) {
			$at_rule = strtolower( strtok( $selector, " \t\r\n(" ) );
			$body    = in_array( $at_rule, [ '@media', '@supports', '@container', '@layer', '@document' ], true )
				? defb_scope_css_rules( $body, $scope )
				: $body;
			$out .= $leading . $selector . " {\n" . $body . "\n}";
		} else {
			$out .= $leading . defb_scope_css_selectors( $selector, $scope ) . ' {' . $body . '}';
		}

		$offset = $end + 1;
	}

	return $out;
}

function defb_strip_css_comments( string $css ): string {
	$result = '';
	$quote = null;
	$length = strlen( $css );
	for ( $index = 0; $index < $length; $index++ ) {
		$character = $css[ $index ];
		if ( $character === '\\' ) {
			$result .= $character . ( $css[ ++$index ] ?? '' );
			continue;
		}
		if ( $quote !== null ) {
			if ( $character === $quote ) {
				$quote = null;
			}
		} elseif ( $character === '"' || $character === "'" ) {
			$quote = $character;
		} elseif ( $character === '/' && ( $css[ $index + 1 ] ?? '' ) === '*' ) {
			$end = strpos( $css, '*/', $index + 2 );
			if ( $end === false ) {
				break;
			}
			$index = $end + 1;
			continue;
		}
		$result .= $character;
	}
	return $result;
}

function defb_find_css_delimiter( string $css, string $delimiter, int $offset = 0 ): int|false {
	$quote = null;
	$depth = 0;
	$length = strlen( $css );
	for ( $index = $offset; $index < $length; $index++ ) {
		$character = $css[ $index ];
		if ( $character === '\\' ) {
			$index++;
			continue;
		}
		if ( $quote !== null ) {
			if ( $character === $quote ) {
				$quote = null;
			}
			continue;
		}
		if ( $character === '"' || $character === "'" ) {
			$quote = $character;
		} elseif ( $character === '/' && ( $css[ $index + 1 ] ?? '' ) === '*' ) {
			$end = strpos( $css, '*/', $index + 2 );
			if ( $end === false ) {
				return false;
			}
			$index = $end + 1;
		} elseif ( $character === '(' || $character === '[' ) {
			$depth++;
		} elseif ( $character === ')' || $character === ']' ) {
			$depth = max( 0, $depth - 1 );
		} elseif ( $character === $delimiter && $depth === 0 ) {
			return $index;
		}
	}
	return false;
}

function defb_find_css_block_end( string $css, int $start ): ?int {
	$depth  = 0;
	$quote  = null;
	$escape = false;
	$len    = strlen( $css );

	for ( $i = $start; $i < $len; $i++ ) {
		$char = $css[ $i ];

		if ( $quote !== null ) {
			if ( $escape ) {
				$escape = false;
			} elseif ( $char === '\\' ) {
				$escape = true;
			} elseif ( $char === $quote ) {
				$quote = null;
			}
			continue;
		}

		if ( $char === '"' || $char === "'" ) {
			$quote = $char;
			continue;
		}

		if ( $char === '/' && ( $css[ $i + 1 ] ?? '' ) === '*' ) {
			$comment_end = strpos( $css, '*/', $i + 2 );
			if ( $comment_end === false ) {
				return null;
			}
			$i = $comment_end + 1;
			continue;
		}

		if ( $char === '{' ) {
			$depth++;
		} elseif ( $char === '}' ) {
			$depth--;
			if ( $depth === 0 ) {
				return $i;
			}
		}
	}

	return null;
}

function defb_scope_css_selectors( string $selector_list, string $scope ): string {
	$selectors = defb_split_css_selectors( $selector_list );
	$scoped    = array_map(
		static function ( string $selector ) use ( $scope ): string {
			$selector = trim( $selector );
			if ( $selector === '' || str_starts_with( $selector, $scope ) ) {
				return $selector;
			}
			if ( preg_match( '/^(?::root|html|body)(?=$|[\s.#:\[>+~])/i', $selector ) ) {
				return preg_replace( '/^(?:(?::root|html|body)(?=$|[\s.#:\[>+~])(?:\s+(?:>\s*)?(?=(?::root|html|body)(?=$|[\s.#:\[>+~])))?)+/i', $scope, $selector );
			}
			return $scope . ' ' . $selector;
		},
		$selectors,
	);

	return implode( ', ', array_filter( $scoped, static fn( string $selector ): bool => $selector !== '' ) );
}

function defb_split_css_selectors( string $selector_list ): array {
	$selectors = [];
	$current   = '';
	$depth     = 0;
	$quote     = null;
	$escape    = false;
	$len       = strlen( $selector_list );

	for ( $i = 0; $i < $len; $i++ ) {
		$char = $selector_list[ $i ];

		if ( $quote !== null ) {
			$current .= $char;
			if ( $escape ) {
				$escape = false;
			} elseif ( $char === '\\' ) {
				$escape = true;
			} elseif ( $char === $quote ) {
				$quote = null;
			}
			continue;
		}

		if ( $char === '"' || $char === "'" ) {
			$quote    = $char;
			$current .= $char;
			continue;
		}

		if ( $char === '(' || $char === '[' ) {
			$depth++;
		} elseif ( ( $char === ')' || $char === ']' ) && $depth > 0 ) {
			$depth--;
		}

		if ( $char === ',' && $depth === 0 ) {
			$selectors[] = $current;
			$current     = '';
			continue;
		}

		$current .= $char;
	}

	$selectors[] = $current;

	return $selectors;
}

// ── Editor scripts + block data ─────────────────────────────────────

add_action( 'enqueue_block_editor_assets', static function (): void {
	$post_id = defb_editor_post_id();
	$blocks  = defb_registered( $post_id );

	if ( empty( $blocks ) ) {
		return;
	}

	$save_path = DEFB_PATH . 'enqueue/register-save.js';
	wp_enqueue_script(
		'defb-save-hook',
		DEFB_URL . 'enqueue/register-save.js',
		[ 'wp-data', 'wp-hooks' ],
		file_exists( $save_path ) ? (string) filemtime( $save_path ) : DEFB_VERSION,
		true,
	);

	$blocks = array_map( static function ( array $block ): array {
		defb_check_block_schema( $block );
		defb_register_server_block( $block );
		unset( $block['render'] );

		$block['supports'] = defb_block_supports( $block );
		$block['_schema']  = defb_resolve_schema( $block );

		$defaults = defb_hydrate_values( [], $block['_schema'] );
		if ( $defaults ) {
			$block['_defaults'] = $defaults;
		}

		return $block;
	}, $blocks );

	$asset_path = DEFB_PATH . 'editor/build/index.asset.php';
	$asset      = file_exists( $asset_path ) ? include $asset_path : [];

	$media_deps = defb_uses_field_type( $blocks, 'media', 'gallery', 'file', 'video' )
		? [ 'media-editor', 'image-edit', 'imgareaselect' ]
		: [];

	wp_enqueue_script(
		'defb-editor',
		DEFB_URL . 'editor/build/index.js',
		array_merge( $asset['dependencies'] ?? [], $media_deps ),
		$asset['version'] ?? DEFB_VERSION,
		true,
	);

	$google_key = apply_filters( 'defb_google_maps_key', apply_filters( 'define_blocks_google_maps_key', null ) );
	$mapbox_key = apply_filters( 'defb_mapbox_key', apply_filters( 'define_blocks_mapbox_key', null ) );

	wp_add_inline_script( 'defb-editor', 'window.defineBlocks = ' . wp_json_encode( [
		'blocks'       => defb_strip_closures( $blocks ),
		'debug'        => (bool) apply_filters( 'defb_editor_debug', defined( 'WP_DEBUG' ) && WP_DEBUG ),
		'keys'         => [
			'googleMaps' => $google_key,
			'mapbox'     => $mapbox_key,
		],
		'fieldAliases' => defb_field_aliases(),
	] ) . ';', 'before' );
} );

// ── Serialization helpers ───────────────────────────────────────────

function defb_editor_post_id(): ?int {
	$post_id = absint( filter_input( INPUT_GET, 'post' ) ); // phpcs:ignore WordPress.Security.NonceVerification.Recommended
	if ( ! $post_id ) {
		$post_id = get_the_ID();
	}

	return $post_id ?: null;
}

function defb_strip_closures( mixed $data ): mixed {
	if ( ! is_array( $data ) ) {
		return $data;
	}

	foreach ( $data as $key => $value ) {
		if (
			$key === 'saveCallback' ||
			$value instanceof \Closure ||
			( $key === 'validate' && is_callable( $value ) )
		) {
			unset( $data[ $key ] );
		} elseif ( is_array( $value ) ) {
			$data[ $key ] = defb_strip_closures( $value );
		}
	}

	return $data;
}

// ── Helpers ─────────────────────────────────────────────────────────

/**
 * Check whether any registered block uses a specific field type.
 */
function defb_uses_field_type( array $blocks, string ...$types ): bool {
	foreach ( $blocks as $block ) {
		$schema = $block['_schema'] ?? defb_resolve_schema( $block );

		$found = defb_walk_schema(
			$schema,
			static function ( array $field ) use ( $types ): ?bool {
				return isset( $field['type'] ) && in_array( $field['type'], $types, true ) ? false : null;
			},
			[ 'include_repeater_fields' => true ],
		) === false;

		if ( $found ) {
			return true;
		}
	}

	return false;
}
