<?php
/**
 * Plugin Name: Content Flow Analytics
 * Plugin URI:  https://github.com/lagostechB0Y/Content-Flow-Analytics
 * Description: Lightweight, self-hosted content engagement analytics with scroll-depth tracking, time-on-page metrics, and a Gutenberg sidebar for per-post insights — no third-party services required.
 * Version:     1.0.0
 * Contributors: Classic40, Lagostechboy
 * Author:      Classic40, Lagostechboy
 * Author URI:  https://github.com/lagostechB0Y
 * License:     GPL-2.0-or-later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: content-flow-analytics
 * Domain Path: /languages
 * Requires at least: 6.6
 * Requires PHP: 7.4
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CFA_VERSION', '1.0.0' );
define( 'CFA_PLUGIN_FILE', __FILE__ );
define( 'CFA_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CFA_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once CFA_PLUGIN_DIR . 'includes/class-activator.php';
require_once CFA_PLUGIN_DIR . 'includes/class-rest-api.php';
require_once CFA_PLUGIN_DIR . 'includes/class-enqueue.php';

register_activation_hook( CFA_PLUGIN_FILE, array( 'CFA_Activator', 'activate' ) );
register_deactivation_hook( CFA_PLUGIN_FILE, array( 'CFA_Activator', 'deactivate' ) );

add_action( 'rest_api_init', array( 'CFA_REST_API', 'register_routes' ) );
add_action( 'wp_enqueue_scripts', array( 'CFA_Enqueue', 'enqueue_frontend' ) );
add_action( 'enqueue_block_editor_assets', array( 'CFA_Enqueue', 'enqueue_block_editor' ) );
