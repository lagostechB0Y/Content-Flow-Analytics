<?php
/**
 * Registers custom REST API endpoints for tracking and retrieving analytics.
 *
 * @package Content_Flow_Analytics
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class CFA_REST_API
 *
 * Provides two REST endpoints under the `content-flow-analytics/v1` namespace:
 *
 *   POST /track  – Accepts a tracking beacon from the frontend tracker.
 *   GET  /stats  – Returns aggregated per-post analytics (requires authentication).
 */
class CFA_REST_API {

	/**
	 * REST API namespace.
	 *
	 * @var string
	 */
	const NAMESPACE = 'content-flow-analytics/v1';

	/**
	 * Registers all plugin REST routes.
	 *
	 * @return void
	 */
	public static function register_routes() {
		register_rest_route(
			self::NAMESPACE,
			'/track',
			array(
				'methods'             => WP_REST_Server::CREATABLE,
				'callback'            => array( __CLASS__, 'handle_track' ),
				'permission_callback' => '__return_true',
				'args'                => array(
					'post_id'      => array(
						'required'          => true,
						'validate_callback' => static function ( $value ) {
							return is_numeric( $value ) && (int) $value > 0;
						},
						'sanitize_callback' => 'absint',
					),
					'session_id'   => array(
						'required'          => true,
						'validate_callback' => static function ( $value ) {
							return is_string( $value ) && preg_match( '/^[a-zA-Z0-9_\-]{8,64}$/', $value );
						},
						'sanitize_callback' => 'sanitize_text_field',
					),
					'scroll_depth' => array(
						'required'          => true,
						'validate_callback' => static function ( $value ) {
							return is_numeric( $value ) && (int) $value >= 0 && (int) $value <= 100;
						},
						'sanitize_callback' => static function ( $value ) {
							return max( 0, min( 100, (int) $value ) );
						},
					),
					'time_on_page' => array(
						'required'          => true,
						'validate_callback' => static function ( $value ) {
							return is_numeric( $value ) && (int) $value >= 0 && (int) $value <= 86400;
						},
						'sanitize_callback' => 'absint',
					),
				),
			)
		);

		register_rest_route(
			self::NAMESPACE,
			'/stats',
			array(
				'methods'             => WP_REST_Server::READABLE,
				'callback'            => array( __CLASS__, 'handle_stats' ),
				'permission_callback' => array( __CLASS__, 'check_stats_permission' ),
				'args'                => array(
					'post_id' => array(
						'required'          => true,
						'validate_callback' => static function ( $value ) {
							return is_numeric( $value ) && (int) $value > 0;
						},
						'sanitize_callback' => 'absint',
					),
				),
			)
		);
	}

	/**
	 * Handles incoming tracking beacons.
	 *
	 * Inserts a new row into the analytics table. Duplicate session rows are
	 * allowed so that incremental updates (e.g., progressive scroll depth) can
	 * be recorded and the latest values are averaged/maxed during aggregation.
	 *
	 * @param WP_REST_Request $request Full data about the request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_track( WP_REST_Request $request ) {
		global $wpdb;

		if ( ! self::check_rate_limit() ) {
			return new WP_Error(
				'cfa_rate_limited',
				__( 'Too many requests. Please try again later.', 'content-flow-analytics' ),
				array( 'status' => 429 )
			);
		}

		$post_id      = $request->get_param( 'post_id' );
		$session_id   = $request->get_param( 'session_id' );
		$scroll_depth = $request->get_param( 'scroll_depth' );
		$time_on_page = $request->get_param( 'time_on_page' );

		// Confirm the post actually exists and is publicly viewable.
		$post = get_post( $post_id );
		if ( ! $post || ! in_array( $post->post_status, array( 'publish', 'private' ), true ) ) {
			return new WP_Error(
				'cfa_invalid_post',
				__( 'Invalid post ID.', 'content-flow-analytics' ),
				array( 'status' => 404 )
			);
		}

		$table_name = $wpdb->prefix . CFA_Activator::TABLE_NAME;

		$inserted = $wpdb->insert(
			$table_name,
			array(
				'post_id'      => $post_id,
				'session_id'   => $session_id,
				'scroll_depth' => $scroll_depth,
				'time_on_page' => $time_on_page,
				'recorded_at'  => current_time( 'mysql', true ),
			),
			array( '%d', '%s', '%d', '%d', '%s' )
		);

		if ( false === $inserted ) {
			return new WP_Error(
				'cfa_db_error',
				__( 'Could not save analytics data.', 'content-flow-analytics' ),
				array( 'status' => 500 )
			);
		}

		return rest_ensure_response( array( 'success' => true ) );
	}

	/**
	 * Returns aggregated analytics statistics for a given post.
	 *
	 * Response shape:
	 * {
	 *   "post_id":           <int>,
	 *   "total_sessions":    <int>,
	 *   "avg_scroll_depth":  <float>,  // percentage, 0–100
	 *   "avg_time_on_page":  <float>,  // seconds
	 *   "max_scroll_depth":  <int>,
	 *   "readability_score": <string>  // human-readable label
	 * }
	 *
	 * @param WP_REST_Request $request Full data about the request.
	 * @return WP_REST_Response|WP_Error
	 */
	public static function handle_stats( WP_REST_Request $request ) {
		global $wpdb;

		$post_id    = $request->get_param( 'post_id' );
		$table_name = $wpdb->prefix . CFA_Activator::TABLE_NAME;

		$row = $wpdb->get_row(
			$wpdb->prepare(
				"SELECT
					COUNT(DISTINCT session_id)     AS total_sessions,
					AVG(scroll_depth)              AS avg_scroll_depth,
					AVG(time_on_page)              AS avg_time_on_page,
					MAX(scroll_depth)              AS max_scroll_depth
				FROM {$table_name}
				WHERE post_id = %d",
				$post_id
			)
		);

		if ( null === $row ) {
			return new WP_Error(
				'cfa_db_error',
				__( 'Could not retrieve analytics data.', 'content-flow-analytics' ),
				array( 'status' => 500 )
			);
		}

		if ( (int) $row->total_sessions === 0 ) {
			return rest_ensure_response(
				array(
					'post_id'        => $post_id,
					'total_sessions' => 0,
				)
			);
		}

		$avg_scroll = (float) $row->avg_scroll_depth;

		return rest_ensure_response(
			array(
				'post_id'           => $post_id,
				'total_sessions'    => (int) $row->total_sessions,
				'avg_scroll_depth'  => round( $avg_scroll, 1 ),
				'avg_time_on_page'  => round( (float) $row->avg_time_on_page, 1 ),
				'max_scroll_depth'  => (int) $row->max_scroll_depth,
				'readability_score' => self::compute_readability_label( $avg_scroll ),
			)
		);
	}

	/**
	 * Permission check for the /stats endpoint.
	 *
	 * Only users who can edit posts (i.e., authors and above) may query stats.
	 *
	 * @return bool|WP_Error
	 */
	public static function check_stats_permission() {
		if ( current_user_can( 'edit_posts' ) ) {
			return true;
		}

		return new WP_Error(
			'cfa_forbidden',
			__( 'You do not have permission to view analytics.', 'content-flow-analytics' ),
			array( 'status' => 403 )
		);
	}

	/**
	 * Maps an average scroll-depth percentage to a human-readable readability label.
	 *
	 * @param float $avg_scroll Average scroll depth (0–100).
	 * @return string
	 */
	private static function compute_readability_label( float $avg_scroll ) {
		if ( $avg_scroll >= 80 ) {
			return __( 'Highly Engaging', 'content-flow-analytics' );
		}
		if ( $avg_scroll >= 50 ) {
			return __( 'Moderate Engagement', 'content-flow-analytics' );
		}
		if ( $avg_scroll >= 20 ) {
			return __( 'Low Engagement', 'content-flow-analytics' );
		}
		return __( 'Very Low Engagement', 'content-flow-analytics' );
	}

	/**
	 * Throttles beacons to 30 per IP per hour to prevent data flooding.
	 *
	 * @return bool
	 */
	private static function check_rate_limit(): bool {
		$ip  = isset( $_SERVER['REMOTE_ADDR'] ) ? sanitize_text_field( wp_unslash( $_SERVER['REMOTE_ADDR'] ) ) : 'unknown';
		$key = 'cfa_rl_' . md5( $ip );

		$count = (int) get_transient( $key );
		if ( $count >= 30 ) {
			return false;
		}

		set_transient( $key, $count + 1, HOUR_IN_SECONDS );
		return true;
	}
}
