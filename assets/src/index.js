/**
 * Content Flow Analytics — Gutenberg Sidebar Panel
 *
 * Registers a PluginSidebar that displays per-post analytics data fetched from
 * the plugin's REST API. The panel is accessible from the block-editor toolbar
 * and automatically reloads data whenever the post ID changes.
 */

import { registerPlugin } from '@wordpress/plugins';
import { PluginSidebarMoreMenuItem, PluginSidebar } from '@wordpress/editor';
import { useSelect } from '@wordpress/data';
import { __ } from '@wordpress/i18n';

import AnalyticsSidebar from './components/AnalyticsSidebar';

const PLUGIN_NAME = 'cfa-sidebar';
const SIDEBAR_TITLE = __( 'Content Flow Analytics', 'content-flow-analytics' );

/**
 * SidebarPlugin component.
 *
 * Retrieves the current post ID from the editor store and passes it down to
 * the AnalyticsSidebar component which handles data fetching and rendering.
 */
function SidebarPlugin() {
	const postId = useSelect( ( select ) =>
		select( 'core/editor' ).getCurrentPostId()
	);

	return (
		<>
			{ /* "More tools & options" menu item */ }
			<PluginSidebarMoreMenuItem target={ PLUGIN_NAME }>
				{ SIDEBAR_TITLE }
			</PluginSidebarMoreMenuItem>

			{ /* Sidebar panel */ }
			<PluginSidebar
				name={ PLUGIN_NAME }
				title={ SIDEBAR_TITLE }
				icon="chart-bar"
			>
				<AnalyticsSidebar postId={ postId } />
			</PluginSidebar>
		</>
	);
}

registerPlugin( PLUGIN_NAME, {
	render: SidebarPlugin,
} );
