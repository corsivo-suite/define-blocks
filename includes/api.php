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
			$accepted = [];

			foreach ( $metas as $meta_key => $meta_value ) {
				if ( ! is_string( $meta_key ) || ! isset( $meta_fields[ $meta_key ] ) ) {
					continue;
				}
				if ( ! defb_user_can_save_meta( $post_id, $meta_key ) ) {
					return new WP_Error( 'rest_forbidden_meta', __( 'You do not have permission to edit this meta field.', 'define-blocks' ), [ 'status' => 403 ] );
				}
				$accepted[ $meta_key ] = $meta_value;
			}

			$entries = defb_meta_save_entries( $post_id, $accepted );
			foreach ( $entries as $meta_key => $entry ) {
				if ( ! $entry['can_save'] ) {
					$message = is_string( $entry['validation'] ) ? $entry['validation'] : __( 'The field value is invalid.', 'define-blocks' );
					return new WP_Error( 'defb_invalid_meta_value', $message, [ 'status' => 400, 'field' => $meta_key ] );
				}
			}
			foreach ( $entries as $meta_key => $entry ) {
				update_post_meta( $post_id, $meta_key, wp_slash( $entry['value'] ) );
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
			'meta'    => [ 'required' => true, 'sanitize_callback' => 'defb_sanitize_meta_key' ],
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

	// ── Taxonomy search ─────────────────────────────────────────
	register_rest_route( $ns, '/taxonomy/terms', [
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => $check,
		'args'                => [
			'taxonomy' => [ 'required' => true, 'sanitize_callback' => 'sanitize_key' ],
			'search'   => [ 'default' => '', 'sanitize_callback' => 'sanitize_text_field' ],
			'include'  => [ 'default' => [], 'sanitize_callback' => 'defb_sanitize_term_ids' ],
			'page'     => [ 'default' => 1, 'sanitize_callback' => static fn( $value ): int => max( 1, absint( $value ) ) ],
			'per_page' => [ 'default' => 20, 'sanitize_callback' => static fn( $value ): int => min( 100, max( 1, absint( $value ) ) ) ],
		],
		'callback' => 'defb_rest_search_terms',
	] );

	// ── Post preview data ───────────────────────────────────────

	register_rest_route( $ns, '/posts/preview/(?P<id>\d+)', [
		'methods'             => WP_REST_Server::READABLE,
		'permission_callback' => static function ( WP_REST_Request $req ): bool|WP_Error {
			$post_id = (int) $req->get_param( 'id' );
			$post = $post_id ? get_post( $post_id ) : null;
			if (
				! $post ||
				! defb_current_user_can_edit_content() ||
				! in_array( $post->post_type, defb_searchable_post_types(), true ) ||
				! current_user_can( 'read_post', $post_id )
			) {
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
			'context'    => [ 'default' => [], 'sanitize_callback' => static fn( $value ) => is_array( $value ) ? $value : [] ],
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
			if ( ! is_array( $raw_values ) ) {
				return defb_invalid_field_value();
			}
			$values               = defb_sanitize_attributes( $raw_values, $block_def, false );
			if ( is_wp_error( $values ) ) {
				return $values;
			}
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
				foreach ( $blocks as $definition ) {
					defb_register_server_block( $definition );
				}
				$serialized_attributes = serialize_block_attributes( $attributes );
				$serialized_block      = '<!-- wp:' . $block_name . ' ' . $serialized_attributes . ' -->'
					. $content
					. '<!-- /wp:' . $block_name . ' -->';
				$parsed_block          = parse_blocks( $serialized_block )[0];
				$context               = defb_sanitize_preview_context( $req->get_param( 'context' ) ?? [] );
				$context               = array_replace( $context, [
					'postId'   => $post_id,
					'postType' => $post->post_type,
				] );
				$wp_block              = new WP_Block( $parsed_block, $context );
				$html                  = $wp_block->render();
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

function defb_sanitize_meta_key( mixed $value ): string {
	return is_scalar( $value ) ? sanitize_text_field( (string) $value ) : '';
}

function defb_sanitize_term_ids( mixed $value ): array {
	$values = is_array( $value ) ? $value : explode( ',', (string) $value );
	return array_values( array_unique( array_filter( array_map( 'absint', $values ) ) ) );
}

function defb_rest_search_terms( WP_REST_Request $request ): WP_REST_Response|WP_Error {
	$taxonomy_name = sanitize_key( (string) $request->get_param( 'taxonomy' ) );
	$taxonomy      = get_taxonomy( $taxonomy_name );

	if ( ! $taxonomy ) {
		return new WP_Error( 'bad_taxonomy', __( 'Invalid taxonomy.', 'define-blocks' ), [ 'status' => 400 ] );
	}

	if ( empty( $taxonomy->cap->assign_terms ) || ! current_user_can( $taxonomy->cap->assign_terms ) ) {
		return new WP_Error( 'rest_forbidden', __( 'You do not have permission to assign terms.', 'define-blocks' ), [ 'status' => 403 ] );
	}

	$page     = max( 1, (int) $request->get_param( 'page' ) );
	$per_page = min( 100, max( 1, (int) $request->get_param( 'per_page' ) ) );
	$include  = defb_sanitize_term_ids( $request->get_param( 'include' ) );
	$args     = [
		'taxonomy'   => $taxonomy_name,
		'hide_empty' => false,
		'orderby'    => 'name',
		'order'      => 'ASC',
		'number'     => $per_page,
		'offset'     => ( $page - 1 ) * $per_page,
	];

	if ( $include ) {
		$args['include'] = $include;
		$args['orderby'] = 'include';
	} else {
		$args['search'] = sanitize_text_field( (string) $request->get_param( 'search' ) );
	}

	$terms = get_terms( $args );
	if ( is_wp_error( $terms ) ) {
		return $terms;
	}

	$count_args           = $args;
	$count_args['fields'] = 'count';
	unset( $count_args['number'], $count_args['offset'] );
	$total = get_terms( $count_args );
	if ( is_wp_error( $total ) ) {
		return $total;
	}

	$response = rest_ensure_response( array_map( 'defb_prepare_term_option', $terms ) );
	$response->header( 'X-WP-Total', (int) $total );
	$response->header( 'X-WP-TotalPages', (int) ceil( (int) $total / $per_page ) );

	return $response;
}

function defb_prepare_term_option( WP_Term $term ): array {
	$names = [];
	foreach ( array_reverse( get_ancestors( $term->term_id, $term->taxonomy, 'taxonomy' ) ) as $ancestor_id ) {
		$ancestor = get_term( $ancestor_id, $term->taxonomy );
		if ( $ancestor instanceof WP_Term ) {
			$names[] = $ancestor->name;
		}
	}
	$names[] = $term->name;

	return [
		'id'     => $term->term_id,
		'name'   => $term->name,
		'parent' => $term->parent,
		'path'   => implode( ' › ', $names ),
	];
}

function defb_sanitize_deep( mixed $data ): mixed {
	return match ( true ) {
		$data === null                       => null,
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

function defb_sanitize_attributes( array $attrs, array $block, bool $hydrate = true ): array|WP_Error {
	$schema    = defb_resolve_schema( $block );
	$field_map = defb_schema_field_map( $schema );
	return defb_normalize_field_values( $hydrate ? defb_hydrate_values( $attrs, $schema ) : $attrs, $field_map, $hydrate );
}

function defb_sanitize_preview_context( mixed $value ): mixed {
	return match ( true ) {
		$value === null                       => null,
		is_array( $value )                     => array_map( __FUNCTION__, $value ),
		is_string( $value )                    => current_user_can( 'unfiltered_html' ) ? $value : wp_kses_post( $value ),
		is_numeric( $value ) || is_bool( $value ) => $value,
		default                                => '',
	};
}

function defb_meta_save_entries( int $post_id, array $metas ): array {
	$entries = [];
	foreach ( defb_registered( $post_id ) as $name => $block ) {
		$schema = defb_resolve_schema( $block );
		$fields = defb_schema_field_map( $schema );
		$relevant = array_filter( $fields, static fn( array $field ): bool => is_string( $field['saveInMeta'] ?? null ) && array_key_exists( $field['saveInMeta'], $metas ) );
		if ( ! $relevant ) {
			continue;
		}
		$instances = defb_get_blocks( $post_id, $name );
		$values = $instances ? end( $instances ) : [];
		foreach ( $relevant as $key => $field ) {
			$values[ $key ] = $metas[ $field['saveInMeta'] ];
		}
		$values = defb_hydrate_values( $values, $schema );
		foreach ( defb_schema_field_sets( $schema ) as $field_set ) {
			foreach ( defb_field_save_entries( $field_set, $values, $post_id, $values ) as $entry ) {
				$meta_key = $entry['field']['saveInMeta'] ?? null;
				if ( is_string( $meta_key ) && array_key_exists( $meta_key, $metas ) ) {
					$entries[ $meta_key ] = $entry;
				}
			}
		}
	}
	return $entries;
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
