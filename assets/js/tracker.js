/**
 * Content Flow Analytics — Frontend Tracker
 *
 * Tracks scroll depth and time-on-page for a single WordPress post and sends
 * the data to the plugin's REST API endpoint via navigator.sendBeacon when the
 * visitor leaves the page (visibilitychange / pagehide events).
 *
 * All configuration is injected by PHP via wp_localize_script as `window.cfaData`:
 *   cfaData.restUrl  {string}  – Full URL of the /track REST endpoint.
 *   cfaData.nonce    {string}  – WordPress nonce for X-WP-Nonce header.
 *   cfaData.postId   {number}  – The ID of the currently viewed post.
 */

( function ( data ) {
	'use strict';

	if ( ! data || ! data.restUrl || ! data.postId ) {
		return;
	}

	/* -------------------------------------------------------------------------
	 * Session ID
	 * A lightweight random identifier that groups all beacon events for a single
	 * page visit. It is stored in sessionStorage so it persists across beacon
	 * retries but resets when the browser tab is closed.
	 * ---------------------------------------------------------------------- */
	var SESSION_KEY = 'cfa_session_' + data.postId;
	var sessionId = sessionStorage.getItem( SESSION_KEY );
	if ( ! sessionId ) {
		// Use crypto.getRandomValues for unguessable session identifiers.
		var buf = new Uint8Array( 16 );
		( window.crypto || window.msCrypto ).getRandomValues( buf );
		sessionId = 'cfa-' + Array.from( buf, function ( b ) {
			return b.toString( 16 ).padStart( 2, '0' );
		} ).join( '' );
		sessionStorage.setItem( SESSION_KEY, sessionId );
	}

	/* -------------------------------------------------------------------------
	 * Time tracking
	 * Measures active engagement time. The timer pauses while the document is
	 * hidden (e.g., the user switches tabs) to avoid inflating numbers.
	 * ---------------------------------------------------------------------- */
	var startTime   = Date.now();
	var activeMs    = 0;
	var lastVisible = Date.now();

	function onVisibilityChange() {
		if ( document.hidden ) {
			activeMs += Date.now() - lastVisible;
		} else {
			lastVisible = Date.now();
		}
	}

	document.addEventListener( 'visibilitychange', onVisibilityChange );

	function getTotalActiveSeconds() {
		var total = activeMs;
		if ( ! document.hidden ) {
			total += Date.now() - lastVisible;
		}
		return Math.round( total / 1000 );
	}

	/* -------------------------------------------------------------------------
	 * Scroll depth tracking
	 * Records the maximum scroll percentage the visitor reached. Uses a
	 * requestAnimationFrame-throttled scroll handler to keep CPU overhead low.
	 * ---------------------------------------------------------------------- */
	var maxScrollDepth = 0;
	var ticking        = false;

	function computeScrollDepth() {
		var scrollTop    = window.pageYOffset || document.documentElement.scrollTop || 0;
		var docHeight    = Math.max(
			document.body.scrollHeight,
			document.documentElement.scrollHeight,
			document.body.offsetHeight,
			document.documentElement.offsetHeight
		) - window.innerHeight;

		if ( docHeight <= 0 ) {
			return 100;
		}

		return Math.min( 100, Math.round( ( scrollTop / docHeight ) * 100 ) );
	}

	function onScroll() {
		if ( ! ticking ) {
			window.requestAnimationFrame( function () {
				var depth = computeScrollDepth();
				if ( depth > maxScrollDepth ) {
					maxScrollDepth = depth;
				}
				ticking = false;
			} );
			ticking = true;
		}
	}

	window.addEventListener( 'scroll', onScroll, { passive: true } );

	// Capture current depth immediately in case the content fits the viewport.
	maxScrollDepth = computeScrollDepth();

	/* -------------------------------------------------------------------------
	 * Beacon dispatch
	 * Sends a JSON payload to the REST endpoint when the visitor leaves. Uses
	 * navigator.sendBeacon (non-blocking, survives page unload) with a fallback
	 * to a synchronous XMLHttpRequest for older browsers.
	 * ---------------------------------------------------------------------- */
	function sendBeacon() {
		var payload = JSON.stringify( {
			post_id:      data.postId,
			session_id:   sessionId,
			scroll_depth: maxScrollDepth,
			time_on_page: getTotalActiveSeconds(),
		} );

		var blob = new Blob( [ payload ], { type: 'application/json' } );

		if ( navigator.sendBeacon ) {
			navigator.sendBeacon( data.restUrl, blob );
		} else {
			// Synchronous XHR fallback — used only when sendBeacon is unavailable.
			var xhr = new XMLHttpRequest();
			xhr.open( 'POST', data.restUrl, false );
			xhr.setRequestHeader( 'Content-Type', 'application/json' );
			if ( data.nonce ) {
				xhr.setRequestHeader( 'X-WP-Nonce', data.nonce );
			}
			try {
				xhr.send( payload );
			} catch ( e ) {
				// Silently fail — analytics should never disrupt the user experience.
			}
		}
	}

	/* Send beacon on pagehide (fired on navigation, tab close, and bfcache
	 * entry) as well as visibilitychange to 'hidden' (fired earlier on some
	 * mobile browsers). Guard against double-sending with a flag. */
	var beaconSent = false;

	function maybeDispatch() {
		if ( ! beaconSent ) {
			beaconSent = true;
			sendBeacon();
		}
	}

	window.addEventListener( 'pagehide', maybeDispatch );

	document.addEventListener( 'visibilitychange', function () {
		if ( document.hidden ) {
			maybeDispatch();
		}
	} );

} )( window.cfaData );
