<?php
/**
 * Runs on plugin uninstall. Removes all plugin data from the database.
 *
 * @package Content_Flow_Analytics
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

global $wpdb;

// phpcs:ignore WordPress.DB.DirectDatabaseQuery
$wpdb->query( 'DROP TABLE IF EXISTS `' . $wpdb->prefix . 'cfa_analytics`' );

delete_option( 'cfa_version' );
