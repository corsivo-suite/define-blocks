<?php
/**
 * REST API endpoints.
 *
 * @package DefineBlocks
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'rest_api_init', static function (): void {
	$ns = 'defb/v1';

	$check = static function ( WP_REST_Request $req ): bool|WP_Error {
		$post_id = (int) $req->get_param( 'post_id' );
		if ( $post_id ) {
			if ( ! current_user_can( 'edit_post', $post_id ) ) {
				return new WP_Error( 'rest_forbidden', __( 'You do not have permission to edit this post.', 'define-blocks' ), [ 'status' => 403 ] );
			}

			return true;
		}

		if ( ! defb_current_user_can_edit_content() ) {
			return new WP_Error( 'rest_forbidden', __( 'Insufficient permissions.', 'define-blocks' ), [ 'status' => 403 ] );
		}

		return true;
	};

	// ── Meta persistence ────────────────────────────────────────

	register_rest_route( $ns, '/meta', [
		'methods'             => WP_REST_Server::EDITABLE,
		'permission_callback' => $check,
		'args'                => [
			'post_id' => [ 'required' => true, 'sanitize_callback' => 'absint' ],
			'metas'   => [ 'required' => false, 'default' => [], 'sanitize_callback' => static fn( $v ) => is_array( $v ) ? $v : [] ],
		],
		'callback' => static function ( WP_REST_Request $req ): WP_REST_Response|WP_Error {
			$post_id = (int) $req->get_param( 'post_id' );
			$post    = get_post( $post_id );

			if ( ! $post ) {
				return new WP_Error( 'not_found', __( 'Post not found.', 'define-blocks' ), [ 'status' => 404 ] );
			}

			$metas = $req->get_param( 'metas' );
			if ( ! is_array( $metas ) || empty( $metas ) ) {
				return rest_ensure_response( [ 'ok' => true ] );
			}

			$meta_fields = defb_meta_field_map( $post_id );

			foreach ( $metas as $meta_key => $meta_value ) {
				if ( ! is_string( $meta_key ) || ! isset( $meta_fields[ $meta_key ] ) ) {
					continue;
				}
				$safe_val = defb_sanitize_value( $meta_value, $meta_fields[ $meta_key ] );
				update_post_meta( $post_id, $meta_key, wp_slash( $safe_val ) );
			}

			return rest_ensure_response( [ 'ok' => true ] );
		},
	] );

	// ── Post search ─────────────────────────────────────────────

	register_rest_route( $ns, '/posts/search', [
		'methods'             => [ 'GET', 'POST' ],
		'permission_callback' => $check,
		'args'                => [
			's'         => [ 'sanitize_callback' => 'sanitize_text_field' ],
			'post_type' => [ 'default' => 'all', 'sanitize_callback' => static fn( $v ) => is_array( $v ) ? array_map( 'sanitize_text_field', $v ) : sanitize_text_field( $v ) ],
		],
		'callback' => static function ( WP_REST_Request $req ): WP_REST_Response|WP_Error {
			$search = sanitize_text_field( $req->get_param( 's' ) ?? '' );
			if ( ! $search ) {
				return rest_ensure_response( [] );
			}

			$requested_types = array_filter( array_map( 'sanitize_text_field', (array) $req->get_param( 'post_type' ) ) );
			$searchable_types = defb_searchable_post_types();
			$has_all          = in_array( 'all', $requested_types, true );
			$types            = array_values( array_intersect( $requested_types, $searchable_types ) );

			if ( ! $has_all && empty( $types ) ) {
				return new WP_Error( 'bad_type', __( 'Invalid post type.', 'define-blocks' ), [ 'status' => 400 ] );
			}

			return rest_ensure_response( defb_query_posts( [
				's'              => $search,
				'post_type'      => $has_all ? $searchable_types : $types,
				'posts_per_page' => 50,
				'post_status'    => 'publish',
			] ) );
		},
	] );

	// ── All posts by type ───────────────────────────────────────

	register_rest_route( $ns, '/posts/list', [
		'methods'             => [ 'GET', 'POST' ],
		'permission_callback' => $check,
		'args'                => [
			'post_type' => [ 'default' => 'post', 'sanitize_callback' => 'sanitize_text_field' ],
		],
		'callback' => static function ( WP_REST_Request $req ): WP_REST_Response|WP_Error {
			$pt = $req->get_param( 'post_type' );

			$searchable_types = defb_searchable_post_types();

			if ( $pt === 'all' ) {
				$pt = $searchable_types;
			} elseif ( ! in_array( $pt, $searchable_types, true ) ) {
				return new WP_Error( 'bad_type', __( 'Invalid post type.', 'define-blocks' ), [ 'status' => 400 ] );
			}

			return rest_ensure_response( defb_query_posts( [
				'post_type'      => $pt,
				'posts_per_page' => 100,
				'post_status'    => 'publish',
				'orderby'        => 'title',
				'order'          => 'ASC',
			] ) );
		},
	] );

	// ── Single post meta ────────────────────────────────────────

	register_rest_route( $ns, '/posts/meta', [
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => $check,
		'args'                => [
			'post_id' => [ 'required' => true, 'sanitize_callback' => 'absint' ],
			'meta'    => [ 'required' => true, 'sanitize_callback' => 'sanitize_key' ],
		],
		'callback' => static function ( WP_REST_Request $req ): WP_REST_Response|WP_Error {
			$post_id    = (int) $req->get_param( 'post_id' );
			$meta_key   = $req->get_param( 'meta' );
			$meta_fields = defb_meta_field_map( $post_id );

			if ( ! isset( $meta_fields[ $meta_key ] ) ) {
				return new WP_Error( 'rest_forbidden_meta', __( 'This meta field is not available.', 'define-blocks' ), [ 'status' => 403 ] );
			}

			return rest_ensure_response( get_post_meta( $post_id, $meta_key, true ) );
		},
	] );

	// ── Post preview data ───────────────────────────────────────

	register_rest_route( $ns, '/posts/preview/(?P<id>\d+)', [
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => static function ( WP_REST_Request $req ): bool|WP_Error {
			$post_id = (int) $req->get_param( 'id' );
			if ( ! $post_id || ! current_user_can( 'read_post', $post_id ) ) {
				return new WP_Error( 'rest_forbidden', __( 'You do not have permission to read this post.', 'define-blocks' ), [ 'status' => 403 ] );
			}

			return true;
		},
		'args'                => [
			'id' => [ 'sanitize_callback' => 'absint' ],
		],
		'callback' => static function ( WP_REST_Request $req ): WP_REST_Response|WP_Error {
			$post = get_post( (int) $req->get_param( 'id' ) );
			if ( ! $post ) {
				return new WP_Error( 'not_found', __( 'Post not found.', 'define-blocks' ), [ 'status' => 404 ] );
			}
			return rest_ensure_response( [
				'ID'          => $post->ID,
				'post_title'  => $post->post_title,
				'post_type'   => $post->post_type,
				'post_status' => $post->post_status,
				'image'       => esc_url_raw( (string) get_the_post_thumbnail_url( $post->ID ) ),
				'url'         => esc_url_raw( (string) get_permalink( $post->ID ) ),
			] );
		},
	] );

	// ── Server-side block render ────────────────────────────────

	register_rest_route( $ns, '/render', [
		'methods'             => WP_REST_Server::EDITABLE,
		'permission_callback' => $check,
		'args'                => [
			'blockName'  => [ 'required' => true, 'sanitize_callback' => 'sanitize_text_field' ],
			'post_id'    => [ 'required' => true, 'sanitize_callback' => 'absint' ],
			'attributes' => [ 'default' => [], 'sanitize_callback' => static fn( $v ) => is_array( $v ) ? $v : [] ],
			'content'    => [
				'default'           => '',
				'sanitize_callback' => static function ( $value ): string {
					if ( ! is_string( $value ) ) {
						return '';
					}

					return current_user_can( 'unfiltered_html' ) ? $value : wp_kses_post( $value );
				},
			],
		],
		'callback' => static function ( WP_REST_Request $req ): WP_REST_Response|WP_Error {
			$block_name = $req->get_param( 'blockName' );
			$content    = $req->get_param( 'content' ) ?? '';
			$post_id    = (int) $req->get_param( 'post_id' );

			$blocks    = defb_registered( $post_id );
			$block_def = $blocks[ $block_name ] ?? null;

			if ( ! $block_def ) {
				return new WP_Error( 'not_found', __( 'Block not found.', 'define-blocks' ), [ 'status' => 404 ] );
			}

			$requested_attributes = $req->get_param( 'attributes' );
			$requested_attributes = is_array( $requested_attributes ) ? $requested_attributes : [];
			$is_full_attributes   = array_key_exists( 'values', $requested_attributes );
			$raw_values           = $is_full_attributes ? $requested_attributes['values'] : $requested_attributes;
			$raw_values           = is_array( $raw_values ) ? $raw_values : [];
			$values               = defb_sanitize_attributes( $raw_values, $block_def );
			$values               = array_replace( defb_collect_defaults( defb_resolve_schema( $block_def ) ), $values );
			$attributes           = $is_full_attributes ? defb_sanitize_deep( $requested_attributes ) : [];
			$attributes           = is_array( $attributes ) ? $attributes : [];
			$attributes['values'] = $values;

			$post = get_post( $post_id );
			if ( ! $post ) {
				return new WP_Error( 'not_found', __( 'Post not found.', 'define-blocks' ), [ 'status' => 404 ] );
			}

			$had_post                 = array_key_exists( 'post', $GLOBALS );
			$previous_post            = $GLOBALS['post'] ?? null;
			$previous_block_to_render = WP_Block_Supports::$block_to_render;
			$GLOBALS['post']           = $post;
			setup_postdata( $post );

			try {
				$serialized_attributes = serialize_block_attributes( $attributes );
				$serialized_block      = '<!-- wp:' . $block_name . ' ' . $serialized_attributes . ' -->'
					. $content
					. '<!-- /wp:' . $block_name . ' -->';
				$parsed_block          = parse_blocks( $serialized_block )[0];
				$wp_block              = new WP_Block( $parsed_block, [
					'postId'   => $post_id,
					'postType' => $post->post_type,
				] );
				WP_Block_Supports::$block_to_render = $wp_block->parsed_block;
				$rendered_content = do_blocks( $content );
				$html             = defb_render_output( $block_def, $attributes, $rendered_content, $wp_block );
				if ( $html === null ) {
					$html = $rendered_content;
				} else {
					$html = defb_wrap_render_output( $block_def, $html );
				}
			} catch ( \Throwable ) {
				return new WP_Error( 'render_fail', __( 'Render failed.', 'define-blocks' ), [ 'status' => 500 ] );
			} finally {
				WP_Block_Supports::$block_to_render = $previous_block_to_render;
				if ( $previous_post instanceof WP_Post ) {
					$GLOBALS['post'] = $previous_post;
					setup_postdata( $previous_post );
				} else {
					wp_reset_postdata();
					if ( $had_post ) {
						$GLOBALS['post'] = $previous_post;
					} else {
						unset( $GLOBALS['post'] );
					}
				}
			}

			return rest_ensure_response( $html );
		},
	] );

	// ── File search by URL ──────────────────────────────────────

	register_rest_route( $ns, '/media/search', [
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => $check,
		'args'                => [
			'url' => [ 'required' => true, 'sanitize_callback' => 'esc_url_raw' ],
		],
		'callback' => static function ( WP_REST_Request $req ): WP_REST_Response {
			$url = $req->get_param( 'url' );
			if ( strpos( $url, get_site_url() ) !== 0 ) {
				return rest_ensure_response( false );
			}

			$id = attachment_url_to_postid( $url );
			if ( ! $id ) {
				return rest_ensure_response( false );
			}

			$path = get_attached_file( $id );
			if ( ! $path || ! file_exists( $path ) ) {
				return rest_ensure_response( false );
			}

			return rest_ensure_response( [
				'id'   => $id,
				'url'  => $url,
				'name' => basename( $path ),
				'size' => size_format( filesize( $path ), 2 ),
				'mime' => wp_check_filetype( $path )['type'],
			] );
		},
	] );

} );

// ── Shared helpers ──────────────────────────────────────────────────

function defb_sanitize_deep( mixed $data ): mixed {
	return match ( true ) {
		is_array( $data )                     => array_map( __FUNCTION__, $data ),
		is_string( $data )                    => sanitize_textarea_field( $data ),
		is_numeric( $data ) || is_bool( $data ) => $data,
		default                               => '',
	};
}

function defb_sanitize_value( mixed $value, array $field ): mixed {
	$type = $field['type'] ?? 'text';
	$custom_sanitizer = function_exists( 'defb_get_custom_field_sanitizer' )
		? defb_get_custom_field_sanitizer( $type )
		: null;

	if ( $custom_sanitizer ) {
		return $custom_sanitizer( $value, $field );
	}

	return match ( $type ) {
		'text', 'text-with-parser', 'select', 'autocomplete'
			=> is_string( $value ) ? sanitize_text_field( $value ) : '',

		'textarea'
			=> is_string( $value ) ? sanitize_textarea_field( $value ) : '',

		'richtext'
			=> is_string( $value ) ? wp_kses_post( $value ) : '',

		'color'
			=> defb_sanitize_color( $value ),

		'url', 'video'
			=> is_string( $value ) ? esc_url_raw( $value ) : '',

		'checkbox'
			=> (bool) $value,

		'range'
			=> is_numeric( $value ) ? (float) $value : 0,

		'date', 'time', 'datetime'
			=> is_string( $value ) ? sanitize_text_field( $value ) : '',

		'media'
			=> is_array( $value ) ? defb_sanitize_object( $value, [
				'id' => 'absint', 'url' => 'esc_url_raw',
				'alt' => 'sanitize_text_field', 'title' => 'sanitize_text_field',
			] ) : [],

		'file'
			=> is_array( $value ) ? defb_sanitize_object( $value, [
				'id' => 'absint', 'url' => 'esc_url_raw', 'name' => 'sanitize_text_field',
				'size' => 'sanitize_text_field', 'mime' => 'sanitize_text_field',
			] ) : [],

		'link'
			=> is_array( $value ) ? defb_sanitize_object( $value, [
				'url' => 'esc_url_raw', 'title' => 'sanitize_text_field',
				'opensInNewTab' => 'boolval',
			] ) : [],

		'google-map', 'osm-map', 'mapbox-map', 'google-geocoder', 'mapbox-geocoder', 'osm-geocoder'
			=> is_array( $value ) ? defb_sanitize_object( $value, [
				'lat' => 'floatval', 'lng' => 'floatval',
				'latitude' => 'floatval', 'longitude' => 'floatval',
				'formatted_address' => 'sanitize_text_field', 'address' => 'sanitize_text_field', 'query' => 'sanitize_text_field',
			], true ) : [],

		'gallery'
			=> is_array( $value ) ? array_values( array_map(
				static fn( $item ) => is_array( $item ) ? defb_sanitize_object( $item, [
					'id' => 'absint', 'url' => 'esc_url_raw',
					'alt' => 'sanitize_text_field', 'title' => 'sanitize_text_field',
				] ) : [],
				$value,
			) ) : [],

		'post-selector'
			=> is_array( $value ) ? array_values( array_map(
				static fn( $item ) => is_array( $item ) ? defb_sanitize_object( $item, [
					'id' => 'absint', 'title' => 'sanitize_text_field',
					'permalink' => 'esc_url_raw', 'thumbnail' => 'esc_url_raw',
				] ) : [],
				$value,
			) ) : [],

		'multi-select', 'multi-autocomplete', 'chips', 'taxonomy'
			=> is_array( $value ) ? array_values( array_map(
				static fn( $item ) => is_array( $item ) ? defb_sanitize_object( $item, [
					'value' => 'sanitize_text_field', 'label' => 'sanitize_text_field',
				] ) : [],
				$value,
			) ) : [],

		'repeater'
			=> defb_sanitize_repeater( $value, $field ),

		'innerblocks', 'tabpanels', 'group', 'title'
			=> $value,

		'hidden', 'value'
			=> defb_sanitize_deep( $value ),

		default => defb_sanitize_deep( $value ),
	};
}

function defb_sanitize_color( mixed $value ): string {
	if ( ! is_string( $value ) ) {
		return '';
	}

	$value = trim( $value );
	if ( $value === '' || preg_match( '/[;{}]/', $value ) ) {
		return '';
	}

	$hex = sanitize_hex_color( $value );
	if ( $hex !== null ) {
		return $hex;
	}
	if ( preg_match( '/^rgba?\([0-9.%+,\s\/-]+\)$/i', $value ) ) {
		return $value;
	}

	$declaration = safecss_filter_attr( 'color:' . $value );
	if ( ! str_starts_with( $declaration, 'color:' ) ) {
		return '';
	}

	return trim( substr( $declaration, strlen( 'color:' ) ) );
}

function defb_sanitize_object( array $data, array $rules, bool $strict = false ): array {
	$out = [];
	foreach ( $data as $key => $value ) {
		$sanitizer   = $rules[ $key ] ?? null;
		if ( $strict && ! $sanitizer ) {
			continue;
		}
		$out[ $key ] = $sanitizer ? $sanitizer( $value ) : defb_sanitize_deep( $value );
	}
	return $out;
}

function defb_sanitize_repeater( mixed $value, array $field ): array {
	if ( ! is_array( $value ) ) {
		return [];
	}

	$sub_fields = isset( $field['fields'] ) && is_array( $field['fields'] )
		? defb_flatten_fields( $field['fields'] )
		: [];

	return array_values( array_map( static function ( $item ) use ( $sub_fields ): array {
		if ( ! is_array( $item ) ) {
			return [];
		}

		$out = [];
		foreach ( $item as $key => $val ) {
			if ( $key === '_defb_id' ) {
				$out[ $key ] = sanitize_text_field( $val );
				continue;
			}
			$sub        = $sub_fields[ $key ] ?? null;
			$out[ $key ] = $sub ? defb_sanitize_value( $val, $sub ) : defb_sanitize_deep( $val );
		}
		return $out;
	}, $value ) );
}

function defb_sanitize_attributes( array $attrs, array $block ): array {
	$schema    = defb_resolve_schema( $block );
	$field_map = defb_schema_field_map( $schema );

	$out = [];
	foreach ( $attrs as $key => $value ) {
		$field      = $field_map[ $key ] ?? null;
		$out[ $key ] = $field ? defb_sanitize_value( $value, $field ) : defb_sanitize_deep( $value );
	}

	return $out;
}

function defb_flatten_fields( array $fields ): array {
	$map = [];

	defb_walk_fields( $fields, static function ( array $field, string|int $name ) use ( &$map ): void {
		$type = $field['type'] ?? '';

		if ( $type !== 'group' && $type !== 'tabpanels' ) {
			$map[ $name ] = $field;
		}
	} );

	return $map;
}

function defb_schema_field_map( array $schema ): array {
	$map = [];

	defb_walk_schema( $schema, static function ( array $field, string|int $name ) use ( &$map ): void {
		$type = $field['type'] ?? '';

		if ( $type !== 'group' && $type !== 'tabpanels' ) {
			$map[ $name ] = $field;
		}
	} );

	return $map;
}

function defb_meta_field_map( ?int $post_id = null ): array {
	static $memo = [];
	$memo_key = $post_id ?? 0;
	if ( isset( $memo[ $memo_key ] ) ) {
		return $memo[ $memo_key ];
	}

	$map  = [];
	foreach ( defb_registered( $post_id ) as $block ) {
		$schema = defb_resolve_schema( $block );

		defb_walk_schema( $schema, static function ( array $field ) use ( &$map ): void {
			if ( ! empty( $field['saveInMeta'] ) && is_string( $field['saveInMeta'] ) ) {
				$map[ $field['saveInMeta'] ] = $field;
			}
		} );
	}

	$memo[ $memo_key ] = $map;

	return $map;
}

function defb_excluded_post_types(): array {
	return [ 'attachment', 'custom_css', 'customize_changeset', 'nav_menu_item', 'oembed_cache', 'revision', 'user_request', 'wp_block' ];
}

function defb_current_user_can_edit_content(): bool {
	foreach ( get_post_types( [ 'show_ui' => true ], 'objects' ) as $post_type ) {
		if (
			! in_array( $post_type->name, defb_excluded_post_types(), true ) &&
			isset( $post_type->cap->edit_posts ) &&
			current_user_can( $post_type->cap->edit_posts )
		) {
			return true;
		}
	}

	return false;
}

function defb_searchable_post_types(): array {
	return array_values( array_diff(
		get_post_types( [ 'public' => true ], 'names' ),
		defb_excluded_post_types(),
	) );
}

function defb_query_posts( array $args ): array {
	$query = new WP_Query( $args );
	$out   = [];

	foreach ( $query->posts as $p ) {
		$type_obj = get_post_type_object( $p->post_type );
		$out[]    = [
			'id'        => $p->ID,
			'title'     => $p->post_title,
			'type'      => $p->post_type,
			'typeLabel' => $type_obj ? $type_obj->labels->singular_name : ucfirst( $p->post_type ),
			'permalink' => esc_url_raw( (string) get_permalink( $p->ID ) ),
			'thumbnail' => esc_url_raw( (string) get_the_post_thumbnail_url( $p->ID, 'thumbnail' ) ),
		];
	}

	return $out;
}
