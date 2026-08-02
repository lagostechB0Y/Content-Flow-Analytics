/**
 * Webpack configuration for Content Flow Analytics Gutenberg sidebar.
 *
 * Extends the default @wordpress/scripts webpack config so that
 * WordPress core packages (wp-element, wp-components, etc.) are
 * correctly externalised and not bundled into the output.
 */

const defaultConfig = require( '@wordpress/scripts/config/webpack.config' );

module.exports = {
	...defaultConfig,
	entry: {
		index: './assets/src/index.js',
	},
	output: {
		...defaultConfig.output,
		path: require( 'path' ).resolve( __dirname, 'assets/build' ),
	},
};
