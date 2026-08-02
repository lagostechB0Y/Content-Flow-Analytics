# Content Flow Analytics

> Lightweight, self-hosted content-engagement analytics for WordPress — no third-party services required.

[![License: GPL v2](https://img.shields.io/badge/License-GPL%20v2-blue.svg)](https://www.gnu.org/licenses/gpl-2.0)
[![Requires WordPress: 6.0+](https://img.shields.io/badge/WordPress-6.0%2B-blue)](https://wordpress.org/)
[![Requires PHP: 7.4+](https://img.shields.io/badge/PHP-7.4%2B-purple)](https://www.php.net/)

---

## Features

- **Scroll-depth tracking** — records how far each visitor scrolls through your post (0–100 %).
- **Time-on-page tracking** — measures active engagement time, pausing while the tab is hidden.
- **Gutenberg sidebar panel** — view per-post stats (sessions, avg. scroll depth, avg. time, readability score) directly inside the block editor.
- **Self-hosted** — all data is stored in your own WordPress database; nothing is sent to third parties.
- **Beacon-based** — uses `navigator.sendBeacon` so tracking never blocks page load or navigation.

---

## Directory Structure

```
content-analytics/
├── content-analytics.php          # Plugin bootstrap (headers, constants, hooks)
├── includes/
│   ├── class-activator.php        # Creates/upgrades the custom DB table on activation
│   ├── class-rest-api.php         # REST endpoints: POST /track  GET /stats
│   └── class-enqueue.php          # Loads tracker.js on the frontend; sidebar in editor
└── assets/
    ├── js/
    │   └── tracker.js             # Vanilla JS scroll + time tracker (sendBeacon)
    ├── src/
    │   ├── index.js               # Gutenberg PluginSidebar registration
    │   └── components/
    │       └── AnalyticsSidebar.js  # React sidebar panel (fetch → render)
    └── build/                     # Compiled React output (git-ignored, run npm build)
```

---

## Installation

### From source

1. Clone or download this repository into your WordPress plugins directory:
   ```bash
   cd /path/to/wordpress/wp-content/plugins/
   git clone https://github.com/lagostechB0Y/Content-Flow-Analytics.git content-analytics
   ```

2. Install Node dependencies and build the Gutenberg sidebar:
   ```bash
   cd content-analytics
   npm install
   npm run build
   ```

3. Activate the plugin via **Plugins → Installed Plugins** in the WordPress admin.

On activation the plugin automatically creates the `{prefix}_cfa_analytics` database table.

---

## REST API Endpoints

All endpoints are registered under the `content-flow-analytics/v1` namespace.

### `POST /wp-json/content-flow-analytics/v1/track`

Records a tracking beacon. Called automatically by `tracker.js` — you do not need to call this manually.

| Parameter     | Type    | Required | Description                             |
|---------------|---------|----------|-----------------------------------------|
| `post_id`     | integer | ✅        | WordPress post ID                       |
| `session_id`  | string  | ✅        | Client-generated session identifier     |
| `scroll_depth`| integer | ✅        | Max scroll percentage reached (0–100)   |
| `time_on_page`| integer | ✅        | Active seconds spent on the page        |

**Response (200):**
```json
{ "success": true }
```

---

### `GET /wp-json/content-flow-analytics/v1/stats?post_id={id}`

Returns aggregated analytics for a post. Requires the caller to be logged in with `edit_posts` capability (authors, editors, admins).

**Response (200):**
```json
{
  "post_id": 42,
  "total_sessions": 158,
  "avg_scroll_depth": 64.3,
  "avg_time_on_page": 87.5,
  "max_scroll_depth": 100,
  "readability_score": "Moderate Engagement"
}
```

**Readability score labels:**

| Score                  | Avg. scroll depth |
|------------------------|-------------------|
| Highly Engaging        | ≥ 80 %            |
| Moderate Engagement    | 50–79 %           |
| Low Engagement         | 20–49 %           |
| Very Low Engagement    | < 20 %            |

---

## Development

| Command         | Description                                     |
|-----------------|-------------------------------------------------|
| `npm run build` | Compile React sidebar to `assets/build/`        |
| `npm run start` | Watch mode — recompile on file changes          |
| `npm run lint:js` | Lint JavaScript source files                  |

---

## Database Schema

Table: `{wpdb->prefix}cfa_analytics`

| Column        | Type                  | Description                              |
|---------------|-----------------------|------------------------------------------|
| `id`          | BIGINT UNSIGNED PK    | Auto-incrementing row ID                 |
| `post_id`     | BIGINT UNSIGNED       | WordPress post ID (indexed)              |
| `session_id`  | VARCHAR(64)           | Client session token (indexed)           |
| `scroll_depth`| TINYINT UNSIGNED      | Max scroll percentage reached (0–100)    |
| `time_on_page`| INT UNSIGNED          | Active seconds on the page               |
| `recorded_at` | DATETIME              | UTC timestamp of the beacon              |

---

## License

This plugin is licensed under the [GNU General Public License v2.0](https://www.gnu.org/licenses/gpl-2.0.html) or later.
