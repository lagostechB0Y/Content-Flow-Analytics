<?php
/**
 * Handles plugin activation and database table creation.
 *
 * @package Content_Flow_Analytics
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Class CFA_Activator
 *
 * Creates and removes the custom analytics table on plugin activation/deactivation.
 */
class CFA_Activator {

	/**
	 * Name of the custom database table (without the WordPress prefix).
	 *
	 * @var string
	 */
	const TABLE_NAME = 'cfa_analytics';

	/**
	 * Runs on plugin activation.
	 *
	 * Creates the custom analytics table if it does not already exist and
	 * stores the current plugin version in the options table.
	 *
	 * @return void
	 */
	public static function activate() {
		self::create_table();
		update_option( 'cfa_version', CFA_VERSION );
	}

	/**
	 * Runs on plugin deactivation.
	 *
	 * Currently a no-op. The table and data are intentionally preserved so
	 * that analytics history is not lost on deactivation.
	 *
	 * @return void
	 */
	public static function deactivate() {
		// Intentionally left empty — data is preserved across deactivation.
	}

	/**
	 * Creates the custom analytics database table.
	 *
	 * Uses dbDelta() so the schema is safely upgraded on subsequent activations.
	 *
	 * Schema
	 * ------
	 * id           – Auto-incrementing primary key.
	 * post_id      – The WordPress post that was viewed.
	 * session_id   – Random identifier generated client-side to group a single visit.
	 * scroll_depth – Maximum scroll percentage reached (0–100).
	 * time_on_page – Total seconds the visitor actively engaged with the page.
	 * recorded_at  – UTC timestamp of when the beacon was received.
	 *
	 * @return void
	 */
	public static function create_table() {
		global $wpdb;

		$table_name      = $wpdb->prefix . self::TABLE_NAME;
		$charset_collate = $wpdb->get_charset_collate();

		$sql = "CREATE TABLE {$table_name} (
			id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
			post_id bigint(20) UNSIGNED NOT NULL,
			session_id varchar(64) NOT NULL DEFAULT '',
			scroll_depth tinyint(3) UNSIGNED NOT NULL DEFAULT 0,
			time_on_page int(10) UNSIGNED NOT NULL DEFAULT 0,
			recorded_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
			PRIMARY KEY  (id),
			KEY post_id (post_id),
			KEY session_id (session_id)
		) {$charset_collate};";

		require_once ABSPATH . 'wp-admin/includes/upgrade.php';
		dbDelta( $sql );
	}
}
