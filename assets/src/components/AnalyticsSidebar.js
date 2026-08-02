/**
 * AnalyticsSidebar component
 *
 * Fetches analytics data from the Content Flow Analytics REST API and renders
 * a summary panel inside the Gutenberg block-editor sidebar.
 *
 * Props:
 *   postId {number|null} – ID of the currently edited post.
 */

import { useState, useEffect, useCallback } from '@wordpress/element';
import { PanelBody, PanelRow, Spinner, Notice, Button } from '@wordpress/components';
import { __ } from '@wordpress/i18n';

/* cfaEditorData is injected by PHP via wp_localize_script */
const { statsUrl, nonce } = window.cfaEditorData || {};

/**
 * Maps a readability label string to a semantic colour token.
 *
 * @param {string} label – Label returned by the REST API.
 * @returns {string} A CSS colour value.
 */
function labelColour( label ) {
	switch ( label ) {
		case 'Highly Engaging':
			return '#00a32a'; // green
		case 'Moderate Engagement':
			return '#dba617'; // amber
		case 'Low Engagement':
			return '#d63638'; // red
		default:
			return '#787c82'; // grey
	}
}

/**
 * Stat row — renders a label / value pair.
 */
function StatRow( { label, value } ) {
	return (
		<PanelRow>
			<span style={ { fontWeight: 600, flexShrink: 0 } }>{ label }</span>
			<span>{ value }</span>
		</PanelRow>
	);
}

/**
 * ScrollBar — a simple percentage-fill progress bar.
 */
function ScrollBar( { percent } ) {
	return (
		<div
			style={ {
				background: '#ddd',
				borderRadius: 4,
				height: 10,
				margin: '4px 0 12px',
				overflow: 'hidden',
			} }
		>
			<div
				style={ {
					background: '#007cba',
					height: '100%',
					width: `${ percent }%`,
					borderRadius: 4,
					transition: 'width 0.4s ease',
				} }
			/>
		</div>
	);
}

/**
 * AnalyticsSidebar
 *
 * Lifecycle:
 *   1. On mount (or when postId changes), fire a fetch to the /stats endpoint.
 *   2. While loading, show a Spinner.
 *   3. On success, render the aggregated metrics.
 *   4. On error or no data, show a helpful notice.
 */
export default function AnalyticsSidebar( { postId } ) {
	const [ stats, setStats ]     = useState( null );
	const [ loading, setLoading ] = useState( false );
	const [ error, setError ]     = useState( null );

	const fetchStats = useCallback( () => {
		if ( ! postId || ! statsUrl ) {
			return;
		}

		setLoading( true );
		setError( null );
		setStats( null );

		fetch( `${ statsUrl }?post_id=${ postId }`, {
			headers: {
				'X-WP-Nonce': nonce || '',
			},
		} )
			.then( ( res ) => {
				if ( ! res.ok ) {
					return res.json().then( ( body ) => {
						throw new Error( body.message || __( 'Failed to load analytics.', 'content-flow-analytics' ) );
					} );
				}
				return res.json();
			} )
			.then( ( body ) => {
				setStats( body );
			} )
			.catch( ( err ) => {
				setError( err.message );
			} )
			.finally( () => {
				setLoading( false );
			} );
	}, [ postId ] );

	useEffect( () => {
		fetchStats();
	}, [ fetchStats ] );

	return (
		<PanelBody
			title={ __( 'Engagement Overview', 'content-flow-analytics' ) }
			initialOpen={ true }
		>
			{ loading && (
				<PanelRow>
					<Spinner />
					<span style={ { marginLeft: 8 } }>
						{ __( 'Loading analytics…', 'content-flow-analytics' ) }
					</span>
				</PanelRow>
			) }

			{ ! loading && error && (
				<>
					<Notice status="warning" isDismissible={ false }>
						{ error }
					</Notice>
					<PanelRow>
						<Button variant="secondary" onClick={ fetchStats }>
							{ __( 'Retry', 'content-flow-analytics' ) }
						</Button>
					</PanelRow>
				</>
			) }

			{ ! loading && stats && stats.total_sessions === 0 && (
				<PanelRow>
					<p style={ { color: '#787c82', fontStyle: 'italic', margin: 0 } }>
						{ __( 'No views recorded yet. Stats will appear once visitors read this post.', 'content-flow-analytics' ) }
					</p>
				</PanelRow>
			) }

			{ ! loading && stats && stats.total_sessions > 0 && (
				<>
					{ /* Readability score badge */ }
					<PanelRow>
						<span style={ { fontWeight: 600, flexShrink: 0 } }>
							{ __( 'Engagement Score', 'content-flow-analytics' ) }
						</span>
						<span
							style={ {
								color: labelColour( stats.readability_score ),
								fontWeight: 700,
							} }
						>
							{ stats.readability_score }
						</span>
					</PanelRow>

					{ /* Scroll depth heatmap bar */ }
					<div style={ { padding: '0 16px' } }>
						<small style={ { display: 'block', marginBottom: 2 } }>
							{ __( 'Avg. Scroll Depth', 'content-flow-analytics' ) }
						</small>
						<ScrollBar percent={ stats.avg_scroll_depth } />
					</div>

					<StatRow
						label={ __( 'Total Sessions', 'content-flow-analytics' ) }
						value={ stats.total_sessions.toLocaleString() }
					/>
					<StatRow
						label={ __( 'Avg. Time on Page', 'content-flow-analytics' ) }
						value={ `${ stats.avg_time_on_page }s` }
					/>
					<StatRow
						label={ __( 'Avg. Scroll Depth', 'content-flow-analytics' ) }
						value={ `${ stats.avg_scroll_depth }%` }
					/>
					<StatRow
						label={ __( 'Max. Scroll Depth', 'content-flow-analytics' ) }
						value={ `${ stats.max_scroll_depth }%` }
					/>

					{ /* Reload button */ }
					<PanelRow>
						<Button variant="tertiary" onClick={ fetchStats }>
							{ __( 'Refresh', 'content-flow-analytics' ) }
						</Button>
					</PanelRow>
				</>
			) }
		</PanelBody>
	);
}
