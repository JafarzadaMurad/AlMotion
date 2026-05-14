<!DOCTYPE html>
<html lang="en">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>JSON2Video API Documentation</title>
    <link
        href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap"
        rel="stylesheet">
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box
        }

        :root {
            --bg: #0a0a0f;
            --bg2: #12121a;
            --bg3: #1a1a28;
            --bg4: #22223a;
            --border: #2a2a40;
            --text: #e0e0f0;
            --text2: #8888aa;
            --accent: #6c5ce7;
            --accent2: #a29bfe;
            --green: #00b894;
            --red: #ff6b6b;
            --orange: #fdcb6e;
            --blue: #74b9ff;
            --method-get: #00b894;
            --method-post: #6c5ce7;
            --method-put: #fdcb6e;
            --method-delete: #ff6b6b;
            --sidebar-w: 280px
        }

        body {
            font-family: 'Inter', sans-serif;
            background: var(--bg);
            color: var(--text);
            line-height: 1.6;
            display: flex;
            min-height: 100vh
        }

        /* Sidebar */
        .sidebar {
            position: fixed;
            top: 0;
            left: 0;
            width: var(--sidebar-w);
            height: 100vh;
            background: var(--bg2);
            border-right: 1px solid var(--border);
            overflow-y: auto;
            z-index: 100;
            padding: 24px 0
        }

        .sidebar-logo {
            padding: 0 24px 24px;
            border-bottom: 1px solid var(--border);
            margin-bottom: 16px
        }

        .sidebar-logo h1 {
            font-size: 18px;
            font-weight: 800;
            background: linear-gradient(135deg, var(--accent), var(--accent2));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent
        }

        .sidebar-logo span {
            font-size: 12px;
            color: var(--text2);
            display: block;
            margin-top: 4px
        }

        .nav-group {
            margin-bottom: 8px
        }

        .nav-group-title {
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1.5px;
            color: var(--text2);
            padding: 12px 24px 6px
        }

        .nav-link {
            display: flex;
            align-items: center;
            gap: 8px;
            padding: 8px 24px;
            color: var(--text2);
            text-decoration: none;
            font-size: 13px;
            font-weight: 500;
            transition: all .2s
        }

        .nav-link:hover,
        .nav-link.active {
            color: var(--text);
            background: var(--bg3)
        }

        .nav-link .method {
            font-size: 10px;
            font-weight: 700;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'JetBrains Mono', monospace;
            min-width: 36px;
            text-align: center
        }

        .method-get {
            background: rgba(0, 184, 148, .15);
            color: var(--method-get)
        }

        .method-post {
            background: rgba(108, 92, 231, .15);
            color: var(--method-post)
        }

        .method-put {
            background: rgba(253, 203, 110, .15);
            color: var(--method-put)
        }

        .method-delete {
            background: rgba(255, 107, 107, .15);
            color: var(--method-delete)
        }

        /* Main */
        .main {
            margin-left: var(--sidebar-w);
            flex: 1;
            padding: 48px 64px;
            max-width: 960px
        }

        .section {
            margin-bottom: 64px;
            scroll-margin-top: 32px
        }

        h2 {
            font-size: 28px;
            font-weight: 800;
            margin-bottom: 8px;
            color: #fff
        }

        h3 {
            font-size: 20px;
            font-weight: 700;
            margin: 32px 0 12px;
            color: #fff
        }

        h4 {
            font-size: 15px;
            font-weight: 600;
            margin: 20px 0 8px;
            color: var(--accent2)
        }

        p {
            color: var(--text2);
            margin-bottom: 12px;
            font-size: 14px
        }

        .endpoint-header {
            display: flex;
            align-items: center;
            gap: 12px;
            margin: 32px 0 16px;
            padding: 16px 20px;
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 10px
        }

        .endpoint-header .method {
            font-size: 13px;
            font-weight: 700;
            padding: 4px 10px;
            border-radius: 5px;
            font-family: 'JetBrains Mono', monospace
        }

        .endpoint-header .path {
            font-family: 'JetBrains Mono', monospace;
            font-size: 14px;
            color: var(--text);
            font-weight: 500
        }

        /* Code blocks */
        pre {
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 10px;
            padding: 16px 20px;
            overflow-x: auto;
            margin: 12px 0 16px;
            font-family: 'JetBrains Mono', monospace;
            font-size: 12.5px;
            line-height: 1.7;
            color: var(--text)
        }

        code {
            font-family: 'JetBrains Mono', monospace;
            font-size: 12.5px
        }

        p code,
        .td-code {
            background: var(--bg4);
            padding: 2px 6px;
            border-radius: 4px;
            font-size: 12px;
            color: var(--accent2)
        }

        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 12px 0 20px;
            font-size: 13px
        }

        th {
            text-align: left;
            padding: 10px 12px;
            background: var(--bg3);
            border: 1px solid var(--border);
            font-weight: 600;
            color: var(--text);
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: .5px
        }

        td {
            padding: 10px 12px;
            border: 1px solid var(--border);
            color: var(--text2);
            vertical-align: top
        }

        td:first-child {
            color: var(--accent2);
            font-family: 'JetBrains Mono', monospace;
            font-size: 12px;
            white-space: nowrap
        }

        tr:hover td {
            background: rgba(108, 92, 231, .03)
        }

        .required {
            color: var(--red);
            font-size: 11px;
            font-weight: 700
        }

        /* Tags */
        .tag {
            display: inline-block;
            font-size: 11px;
            font-weight: 600;
            padding: 2px 8px;
            border-radius: 4px;
            margin-right: 4px
        }

        .tag-string {
            background: rgba(116, 185, 255, .1);
            color: var(--blue)
        }

        .tag-number {
            background: rgba(253, 203, 110, .1);
            color: var(--orange)
        }

        .tag-bool {
            background: rgba(0, 184, 148, .1);
            color: var(--green)
        }

        .tag-array {
            background: rgba(162, 155, 254, .1);
            color: var(--accent2)
        }

        /* Status badges */
        .status {
            padding: 3px 10px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600
        }

        .status-200 {
            background: rgba(0, 184, 148, .1);
            color: var(--green)
        }

        .status-201 {
            background: rgba(0, 184, 148, .1);
            color: var(--green)
        }

        .status-202 {
            background: rgba(116, 185, 255, .1);
            color: var(--blue)
        }

        .status-401 {
            background: rgba(255, 107, 107, .1);
            color: var(--red)
        }

        .status-429 {
            background: rgba(253, 203, 110, .1);
            color: var(--orange)
        }

        /* Alert */
        .alert {
            padding: 14px 18px;
            border-radius: 8px;
            margin: 12px 0;
            font-size: 13px;
            border-left: 3px solid
        }

        .alert-info {
            background: rgba(116, 185, 255, .06);
            border-color: var(--blue);
            color: var(--blue)
        }

        .alert-tip {
            background: rgba(0, 184, 148, .06);
            border-color: var(--green);
            color: var(--green)
        }

        .alert-warn {
            background: rgba(253, 203, 110, .06);
            border-color: var(--orange);
            color: var(--orange)
        }

        .divider {
            border: none;
            border-top: 1px solid var(--border);
            margin: 48px 0
        }

        /* Tabs */
        .tabs {
            display: flex;
            gap: 0;
            margin: 12px 0 0;
            border-bottom: 1px solid var(--border)
        }

        .tab {
            padding: 8px 16px;
            font-size: 12px;
            font-weight: 600;
            color: var(--text2);
            cursor: pointer;
            border-bottom: 2px solid transparent;
            transition: .2s
        }

        .tab:hover {
            color: var(--text)
        }

        .tab.active {
            color: var(--accent2);
            border-color: var(--accent)
        }

        .tab-content {
            display: none
        }

        .tab-content.active {
            display: block
        }

        /* Mobile */
        .menu-toggle {
            display: none;
            position: fixed;
            top: 16px;
            left: 16px;
            z-index: 200;
            background: var(--bg3);
            border: 1px solid var(--border);
            border-radius: 8px;
            padding: 8px 12px;
            color: var(--text);
            cursor: pointer;
            font-size: 18px
        }

        @media(max-width:900px) {
            .sidebar {
                transform: translateX(-100%);
                transition: .3s
            }

            .sidebar.open {
                transform: translateX(0)
            }

            .main {
                margin-left: 0;
                padding: 48px 24px
            }

            .menu-toggle {
                display: block
            }
        }

        .copy-btn {
            position: absolute;
            top: 8px;
            right: 8px;
            background: var(--bg4);
            border: 1px solid var(--border);
            color: var(--text2);
            padding: 4px 10px;
            border-radius: 6px;
            font-size: 11px;
            cursor: pointer;
            opacity: 0;
            transition: .2s
        }

        pre:hover .copy-btn {
            opacity: 1
        }

        .copy-btn:hover {
            background: var(--accent);
            color: #fff
        }

        .pre-wrap {
            position: relative
        }

        .color-key {
            color: #a29bfe
        }

        .color-str {
            color: #81ecec
        }

        .color-num {
            color: #fdcb6e
        }

        .color-bool {
            color: #00b894
        }

        .color-null {
            color: #636e72
        }
    </style>
</head>

<body>
    <button class="menu-toggle" onclick="document.querySelector('.sidebar').classList.toggle('open')">☰</button>

    <aside class="sidebar">
        <div class="sidebar-logo">
            <h1>JSON2Video</h1>
            <span>API Documentation v1</span>
        </div>

        <div class="nav-group">
            <div class="nav-group-title">Getting Started</div>
            <a href="#auth" class="nav-link">🔐 Authentication</a>
            <a href="#errors" class="nav-link">⚠️ Error Codes</a>
        </div>

        <div class="nav-group">
            <div class="nav-group-title">Movies</div>
            <a href="#create-movie" class="nav-link"><span class="method method-post">POST</span> Create Movie</a>
            <a href="#get-movie" class="nav-link"><span class="method method-get">GET</span> Get Status</a>
            <a href="#list-movies" class="nav-link"><span class="method method-get">GET</span> List Movies</a>
            <a href="#delete-movie" class="nav-link"><span class="method method-delete">DEL</span> Delete Movie</a>
        </div>

        <div class="nav-group">
            <div class="nav-group-title">Payload</div>
            <a href="#elements" class="nav-link">📦 Elements Overview</a>
            <a href="#el-image" class="nav-link">🖼️ Image</a>
            <a href="#el-video" class="nav-link">🎬 Video</a>
            <a href="#el-text" class="nav-link">📝 Text</a>
            <a href="#el-audio" class="nav-link">🔊 Audio</a>
            <a href="#el-subtitles" class="nav-link">💬 Subtitles</a>
            <a href="#auto-srt" class="nav-link">🤖 Auto-SRT</a>
            <a href="#glow" class="nav-link">✨ Glow Effect</a>
            <a href="#transitions" class="nav-link">🔄 Transitions</a>
            <a href="#animations" class="nav-link">🎭 Animations</a>
        </div>

        <div class="nav-group">
            <div class="nav-group-title">Templates</div>
            <a href="#list-templates" class="nav-link"><span class="method method-get">GET</span> List</a>
            <a href="#create-template" class="nav-link"><span class="method method-post">POST</span> Create</a>
            <a href="#get-template" class="nav-link"><span class="method method-get">GET</span> Get Detail</a>
            <a href="#update-template" class="nav-link"><span class="method method-put">PUT</span> Update</a>
            <a href="#delete-template" class="nav-link"><span class="method method-delete">DEL</span> Delete</a>
            <a href="#render-template" class="nav-link"><span class="method method-post">POST</span> Render</a>
        </div>

        <div class="nav-group">
            <div class="nav-group-title">Webhooks</div>
            <a href="#get-webhook" class="nav-link"><span class="method method-get">GET</span> Get Config</a>
            <a href="#set-webhook" class="nav-link"><span class="method method-post">POST</span> Set Config</a>
            <a href="#del-webhook" class="nav-link"><span class="method method-delete">DEL</span> Remove</a>
        </div>

        <div class="nav-group">
            <div class="nav-group-title">Account</div>
            <a href="#account" class="nav-link"><span class="method method-get">GET</span> Account Info</a>
        </div>

        <div class="nav-group">
            <div class="nav-group-title">🎬 Visual Effects</div>
            <a href="#effects" class="nav-link">Zoom / Pan / Ken Burns</a>
        </div>

        <div class="nav-group">
            <div class="nav-group-title">Transcription</div>
            <a href="#create-transcribe" class="nav-link"><span class="method method-post">POST</span> Transcribe</a>
            <a href="#get-transcribe" class="nav-link"><span class="method method-get">GET</span> Get Status</a>
        </div>
    </aside>

    <main class="main">
        <!-- AUTH -->
        <section class="section" id="auth">
            <h2>Authentication</h2>
            <p>All API requests require an <code class="td-code">X-API-Key</code> header. Get your API key from the <a
                    href="/dashboard" style="color:var(--accent2)">dashboard</a>.</p>

            <h4>Base URL</h4>
            <pre>http://168.231.108.200:2993/api/v1</pre>

            <h4>Example Request</h4>
            <div class="pre-wrap">
                <pre>curl -H "X-API-Key: YOUR_API_KEY" \
     http://168.231.108.200:2993/api/v1/account</pre>
            </div>

            <table>
                <tr>
                    <th>Header</th>
                    <th>Value</th>
                    <th>Required</th>
                </tr>
                <tr>
                    <td>X-API-Key</td>
                    <td>Your API key string</td>
                    <td><span class="required">Yes</span></td>
                </tr>
                <tr>
                    <td>Content-Type</td>
                    <td>application/json</td>
                    <td>For POST/PUT</td>
                </tr>
            </table>

            <div class="alert alert-info">💡 Rate limiting is per-plan. Check response headers <code
                    class="td-code">X-RateLimit-Limit</code> and <code class="td-code">X-RateLimit-Remaining</code>.
            </div>
        </section>

        <!-- ERRORS -->
        <section class="section" id="errors">
            <h2>Error Codes</h2>
            <table>
                <tr>
                    <th>Status</th>
                    <th>Code</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td><span class="status status-401">401</span></td>
                    <td>AUTH_MISSING_KEY</td>
                    <td>No X-API-Key header</td>
                </tr>
                <tr>
                    <td><span class="status status-401">401</span></td>
                    <td>AUTH_INVALID_KEY</td>
                    <td>API key not found</td>
                </tr>
                <tr>
                    <td><span class="status status-401">403</span></td>
                    <td>AUTH_KEY_INACTIVE</td>
                    <td>Key expired or disabled</td>
                </tr>
                <tr>
                    <td><span class="status status-429">429</span></td>
                    <td>RATE_LIMIT_EXCEEDED</td>
                    <td>Too many requests per minute</td>
                </tr>
                <tr>
                    <td><span class="status status-401">500</span></td>
                    <td>RENDER_ERROR</td>
                    <td>Render process failed</td>
                </tr>
            </table>
        </section>

        <hr class="divider">

        <!-- CREATE MOVIE -->
        <section class="section" id="create-movie">
            <h2>Create Movie</h2>
            <p>Submit a JSON payload to start rendering a video.</p>

            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/movies</span>
            </div>

            <h4>Top-Level Properties</h4>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>resolution</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td></td>
                    <td>full-hd</td>
                    <td><code class="td-code">sd</code> 854×480 · <code class="td-code">hd</code> 1280×720 · <code
                            class="td-code">full-hd</code> 1920×1080 · <code class="td-code">4k</code> 3840×2160 · <code
                            class="td-code">custom</code></td>
                </tr>
                <tr>
                    <td>width</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>If custom</td>
                    <td>—</td>
                    <td>100–7680</td>
                </tr>
                <tr>
                    <td>height</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>If custom</td>
                    <td>—</td>
                    <td>100–4320</td>
                </tr>
                <tr>
                    <td>quality</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td></td>
                    <td>high</td>
                    <td><code class="td-code">low</code> · <code class="td-code">medium</code> · <code
                            class="td-code">high</code></td>
                </tr>
                <tr>
                    <td>fps</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td></td>
                    <td>30</td>
                    <td>24, 25, 30, or 60</td>
                </tr>
                <tr>
                    <td>webhook_url</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td></td>
                    <td>null</td>
                    <td>URL for completion webhook</td>
                </tr>
                <tr>
                    <td>scenes</td>
                    <td><span class="tag tag-array">array</span></td>
                    <td><span class="required">Yes</span></td>
                    <td>—</td>
                    <td>Array of scene objects</td>
                </tr>
            </table>

            <h4>Scene Properties</h4>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>duration</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td><span class="required">Yes</span></td>
                    <td>—</td>
                    <td>Duration in seconds (0.1–600)</td>
                </tr>
                <tr>
                    <td>background</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td></td>
                    <td>#000000</td>
                    <td>Background color (hex)</td>
                </tr>
                <tr>
                    <td>comment</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td></td>
                    <td>—</td>
                    <td>Human label</td>
                </tr>
                <tr>
                    <td>transition</td>
                    <td><span class="tag tag-array">object</span></td>
                    <td></td>
                    <td>—</td>
                    <td>Transition from previous scene</td>
                </tr>
                <tr>
                    <td>elements</td>
                    <td><span class="tag tag-array">array</span></td>
                    <td><span class="required">Yes</span></td>
                    <td>—</td>
                    <td>Array of element objects</td>
                </tr>
            </table>

            <h4>Full Example</h4>
            <div class="pre-wrap">
                <pre><span class="color-key">curl</span> -X POST http://168.231.108.200:2993/api/v1/movies \
  -H "X-API-Key: YOUR_KEY" \
  -H "Content-Type: application/json" \
  -d '{
  <span class="color-key">"resolution"</span>: <span class="color-str">"custom"</span>,
  <span class="color-key">"width"</span>: <span class="color-num">1080</span>,
  <span class="color-key">"height"</span>: <span class="color-num">1920</span>,
  <span class="color-key">"quality"</span>: <span class="color-str">"high"</span>,
  <span class="color-key">"scenes"</span>: [{
    <span class="color-key">"duration"</span>: <span class="color-num">10</span>,
    <span class="color-key">"elements"</span>: [
      { <span class="color-key">"type"</span>: <span class="color-str">"video"</span>, <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/bg.mp4"</span> },
      {
        <span class="color-key">"type"</span>: <span class="color-str">"subtitles"</span>,
        <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/captions.srt"</span>,
        <span class="color-key">"font-size"</span>: <span class="color-num">65</span>,
        <span class="color-key">"highlight-color"</span>: <span class="color-str">"auto"</span>,
        <span class="color-key">"glow-opacity"</span>: <span class="color-num">0.7</span>,
        <span class="color-key">"position-y"</span>: <span class="color-str">"bottom"</span>,
        <span class="color-key">"bottom"</span>: <span class="color-num">170</span>,
        <span class="color-key">"animation"</span>: { <span class="color-key">"type"</span>: <span class="color-str">"bounce"</span>, <span class="color-key">"duration"</span>: <span class="color-num">0.3</span> }
      },
      { <span class="color-key">"type"</span>: <span class="color-str">"audio"</span>, <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/music.mp3"</span>, <span class="color-key">"volume"</span>: <span class="color-num">0.3</span> }
    ]
  }]
}'</pre>
            </div>

            <h4>Response — <span class="status status-202">202 Accepted</span></h4>
            <pre>{
  <span class="color-key">"job_id"</span>: <span class="color-str">"019cec03-6d80-..."</span>,
  <span class="color-key">"status"</span>: <span class="color-str">"queued"</span>,
  <span class="color-key">"created_at"</span>: <span class="color-str">"2026-03-14T11:02:53+00:00"</span>
}</pre>

            <div class="alert alert-tip">💡 Identical payloads return a cache hit with <code class="td-code">200</code>
                and <code class="td-code">"cached": true</code>.</div>
        </section>

        <!-- GET MOVIE -->
        <section class="section" id="get-movie">
            <h2>Get Movie Status</h2>
            <p>Poll this endpoint to check render progress.</p>

            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/movies/{job_id}</span>
            </div>

            <h4>Job Statuses</h4>
            <table>
                <tr>
                    <th>Status</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>queued</td>
                    <td>Waiting in the render queue</td>
                </tr>
                <tr>
                    <td>processing</td>
                    <td>Currently being rendered</td>
                </tr>
                <tr>
                    <td>done</td>
                    <td>Complete — video URL available</td>
                </tr>
                <tr>
                    <td>failed</td>
                    <td>Error occurred — see <code class="td-code">error</code> field</td>
                </tr>
                <tr>
                    <td>expired</td>
                    <td>Video files deleted after retention period</td>
                </tr>
            </table>

            <h4>Response — Completed</h4>
            <pre>{
  <span class="color-key">"job_id"</span>: <span class="color-str">"019cec03-..."</span>,
  <span class="color-key">"status"</span>: <span class="color-str">"done"</span>,
  <span class="color-key">"progress"</span>: <span class="color-num">100</span>,
  <span class="color-key">"url"</span>: <span class="color-str">"http://168.231.108.200:2993/renders/videos/019cec03-....mp4"</span>,
  <span class="color-key">"duration"</span>: <span class="color-num">37.5</span>,
  <span class="color-key">"size_mb"</span>: <span class="color-num">28.9</span>,
  <span class="color-key">"completed_at"</span>: <span class="color-str">"2026-03-14T11:12:30+00:00"</span>,
  <span class="color-key">"expires_at"</span>: <span class="color-str">"2026-03-21T11:12:30+00:00"</span>
}</pre>

            <h4>Response — Failed</h4>
            <pre>{
  <span class="color-key">"status"</span>: <span class="color-str">"failed"</span>,
  <span class="color-key">"error"</span>: <span class="color-str">"Scene #1, element subtitles: cannot open resource"</span>,
  <span class="color-key">"error_code"</span>: <span class="color-str">"RENDER_ERROR"</span>
}</pre>
        </section>

        <!-- LIST MOVIES -->
        <section class="section" id="list-movies">
            <h2>List Movies</h2>
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/movies</span>
            </div>

            <h4>Query Parameters</h4>
            <table>
                <tr>
                    <th>Param</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>status</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td>Filter: queued, processing, done, failed, expired</td>
                </tr>
                <tr>
                    <td>date_from</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td>After this date</td>
                </tr>
                <tr>
                    <td>date_to</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td>Before this date</td>
                </tr>
                <tr>
                    <td>sort_by</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>created_at</td>
                    <td>created_at, status, duration_seconds, file_size_bytes</td>
                </tr>
                <tr>
                    <td>sort_dir</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>desc</td>
                    <td>asc or desc</td>
                </tr>
                <tr>
                    <td>limit</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>20</td>
                    <td>Per page (max 100)</td>
                </tr>
            </table>
        </section>

        <!-- DELETE MOVIE -->
        <section class="section" id="delete-movie">
            <h2>Delete Movie</h2>
            <div class="endpoint-header">
                <span class="method method-delete">DELETE</span>
                <span class="path">/api/v1/movies/{job_id}</span>
            </div>
            <p>Deletes the job record and associated video/thumbnail files.</p>
            <h4>Response — <span class="status status-200">200</span></h4>
            <pre>{ <span class="color-key">"message"</span>: <span class="color-str">"Job and associated files deleted successfully"</span> }</pre>
        </section>

        <hr class="divider">

        <!-- ELEMENTS OVERVIEW -->
        <section class="section" id="elements">
            <h2>Elements Overview</h2>
            <p>Each scene contains an array of elements. Supported types:</p>
            <table>
                <tr>
                    <th>Type</th>
                    <th>Description</th>
                    <th>Required Fields</th>
                </tr>
                <tr>
                    <td>image</td>
                    <td>Static image overlay</td>
                    <td>src</td>
                </tr>
                <tr>
                    <td>video</td>
                    <td>Video clip (with audio)</td>
                    <td>src</td>
                </tr>
                <tr>
                    <td>text</td>
                    <td>Text overlay</td>
                    <td>text</td>
                </tr>
                <tr>
                    <td>audio</td>
                    <td>Background audio/music</td>
                    <td>src</td>
                </tr>
                <tr>
                    <td>subtitles</td>
                    <td>Timed subtitles (SRT/ASS) or inline</td>
                    <td>src or text</td>
                </tr>
            </table>

            <h4>Common Properties (all elements)</h4>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>start</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>0</td>
                    <td>Start time in scene (seconds)</td>
                </tr>
                <tr>
                    <td>duration</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>scene</td>
                    <td>Element duration</td>
                </tr>
                <tr>
                    <td>opacity</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>1.0</td>
                    <td>0.0 – 1.0</td>
                </tr>
                <tr>
                    <td>x</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>0</td>
                    <td>X position (px)</td>
                </tr>
                <tr>
                    <td>y</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>0</td>
                    <td>Y position (px)</td>
                </tr>
                <tr>
                    <td>width</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>auto</td>
                    <td>Element width (px)</td>
                </tr>
                <tr>
                    <td>height</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>auto</td>
                    <td>Element height (px)</td>
                </tr>
            </table>
        </section>

        <!-- IMAGE -->
        <section class="section" id="el-image">
            <h3>🖼️ Image Element</h3>
            <pre>{ <span class="color-key">"type"</span>: <span class="color-str">"image"</span>, <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/photo.jpg"</span>, <span class="color-key">"duration"</span>: <span class="color-num">3</span> }</pre>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>src</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td><span class="required">Yes</span></td>
                    <td>Image URL (JPEG, PNG, WebP)</td>
                </tr>
                <tr>
                    <td>effect</td>
                    <td><span class="tag tag-array">object</span></td>
                    <td></td>
                    <td>Visual effect: <code class="td-code">zoom-in</code>, <code class="td-code">zoom-out</code>,
                        <code class="td-code">pan</code>, <code class="td-code">ken-burns</code>. See <a href="#effects"
                            style="color:var(--accent2)">Visual Effects</a></td>
                </tr>
                <tr>
                    <td>animation</td>
                    <td><span class="tag tag-array">object</span></td>
                    <td></td>
                    <td>Enter/exit animation: <code class="td-code">fade-in</code>, <code
                            class="td-code">fade-out</code>, <code class="td-code">slide-in-*</code>, <code
                            class="td-code">zoom-in</code>, <code class="td-code">bounce</code></td>
                </tr>
            </table>
            <div class="alert alert-info">If width/height omitted, image fills the entire canvas.</div>
        </section>

        <!-- VIDEO -->
        <section class="section" id="el-video">
            <h3>🎬 Video Element</h3>
            <pre>{
  <span class="color-key">"type"</span>: <span class="color-str">"video"</span>,
  <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/clip.mp4"</span>,
  <span class="color-key">"mute"</span>: <span class="color-bool">false</span>,
  <span class="color-key">"volume"</span>: <span class="color-num">0.8</span>,
  <span class="color-key">"trim-start"</span>: <span class="color-num">2.0</span>,
  <span class="color-key">"trim-end"</span>: <span class="color-num">10.0</span>,
  <span class="color-key">"playback-rate"</span>: <span class="color-num">1.5</span>
}</pre>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>src</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td><span class="required">Required.</span> Video URL</td>
                </tr>
                <tr>
                    <td>mute</td>
                    <td><span class="tag tag-bool">bool</span></td>
                    <td>false</td>
                    <td>Strip audio</td>
                </tr>
                <tr>
                    <td>volume</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>1.0</td>
                    <td>Audio volume (0–1)</td>
                </tr>
                <tr>
                    <td>trim-start</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>0</td>
                    <td>Trim start (seconds)</td>
                </tr>
                <tr>
                    <td>trim-end</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>end</td>
                    <td>Trim end (seconds)</td>
                </tr>
                <tr>
                    <td>playback-rate</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>1.0</td>
                    <td>Speed (0.1–10)</td>
                </tr>
                <tr>
                    <td>subtitles</td>
                    <td><span class="tag tag-bool">bool</span> | <span class="tag tag-array">object</span></td>
                    <td>false</td>
                    <td>Auto-generate subtitles from video audio using AI (Whisper). See <a href="#auto-srt"
                            style="color:var(--accent2)">Auto-SRT</a></td>
                </tr>
                <tr>
                    <td>effect</td>
                    <td><span class="tag tag-array">object</span></td>
                    <td>—</td>
                    <td>Visual effect: <code class="td-code">zoom-in</code>, <code class="td-code">zoom-out</code>,
                        <code class="td-code">pan</code>, <code class="td-code">ken-burns</code>. See <a href="#effects"
                            style="color:var(--accent2)">Visual Effects</a></td>
                </tr>
                <tr>
                    <td>animation</td>
                    <td><span class="tag tag-array">object</span></td>
                    <td>—</td>
                    <td>Enter/exit animation: <code class="td-code">fade-in</code>, <code
                            class="td-code">fade-out</code>, <code class="td-code">slide-in-*</code>, <code
                            class="td-code">zoom-in</code>, <code class="td-code">bounce</code></td>
                </tr>
            </table>
        </section>

        <!-- TEXT -->
        <section class="section" id="el-text">
            <h3>📝 Text Element</h3>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>text</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td><span class="required">Required.</span> Text content</td>
                </tr>
                <tr>
                    <td>font-size</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>36</td>
                    <td>1–500</td>
                </tr>
                <tr>
                    <td>color</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>#ffffff</td>
                    <td>Hex color</td>
                </tr>
                <tr>
                    <td>font-family</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>Montserrat</td>
                    <td>Font name</td>
                </tr>
                <tr>
                    <td>text-align</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>center</td>
                    <td>left, center, right</td>
                </tr>
                <tr>
                    <td>background-color</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td>Background highlight</td>
                </tr>
                <tr>
                    <td>max-width</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>—</td>
                    <td>Wrap width</td>
                </tr>
            </table>
        </section>

        <!-- AUDIO -->
        <section class="section" id="el-audio">
            <h3>🔊 Audio Element</h3>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>src</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td><span class="required">Required.</span> Audio URL (MP3, WAV, AAC)</td>
                </tr>
                <tr>
                    <td>volume</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>1.0</td>
                    <td>Volume level (0–1)</td>
                </tr>
                <tr>
                    <td>subtitles</td>
                    <td><span class="tag tag-bool">bool</span> | <span class="tag tag-array">object</span></td>
                    <td>false</td>
                    <td>Auto-generate subtitles from audio using AI (Whisper). See <a href="#auto-srt"
                            style="color:var(--accent2)">Auto-SRT</a></td>
                </tr>
            </table>
        </section>

        <!-- AUTO-SRT -->
        <section class="section" id="auto-srt">
            <h3>🤖 Auto-SRT (AI Subtitle Generation)</h3>
            <p>Automatically generate subtitles from video or audio elements using OpenAI Whisper AI.
                Add <code class="td-code">"subtitles": true</code> to any video or audio element to enable.</p>

            <div class="alert alert-tip">💡 The system uses word-level timestamps to create short, readable subtitle
                blocks (max 7 words each).</div>

            <h4>Simple Usage</h4>
            <pre>{
  <span class="color-key">"type"</span>: <span class="color-str">"audio"</span>,
  <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/voiceover.mp3"</span>,
  <span class="color-key">"subtitles"</span>: <span class="color-bool">true</span>
}</pre>

            <h4>With Custom Style</h4>
            <pre>{
  <span class="color-key">"type"</span>: <span class="color-str">"video"</span>,
  <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/interview.mp4"</span>,
  <span class="color-key">"subtitles"</span>: {
    <span class="color-key">"enabled"</span>: <span class="color-bool">true</span>,
    <span class="color-key">"font-size"</span>: <span class="color-num">48</span>,
    <span class="color-key">"color"</span>: <span class="color-str">"#ffffff"</span>,
    <span class="color-key">"bottom"</span>: <span class="color-num">150</span>,
    <span class="color-key">"stroke-color"</span>: <span class="color-str">"#000000"</span>,
    <span class="color-key">"stroke-width"</span>: <span class="color-num">3</span>,
    <span class="color-key">"animation"</span>: { <span class="color-key">"type"</span>: <span class="color-str">"highlight"</span>, <span class="color-key">"highlight-color"</span>: <span class="color-str">"auto"</span> }
  }
}</pre>

            <h4>Subtitles Config Properties</h4>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>enabled</td>
                    <td><span class="tag tag-bool">bool</span></td>
                    <td>true</td>
                    <td>Enable/disable auto subtitles</td>
                </tr>
                <tr>
                    <td>font-size</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>32</td>
                    <td>Subtitle font size (8–200)</td>
                </tr>
                <tr>
                    <td>color</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>#ffffff</td>
                    <td>Text color (hex)</td>
                </tr>
                <tr>
                    <td>font</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>Montserrat</td>
                    <td>Font name</td>
                </tr>
                <tr>
                    <td>bottom</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>100</td>
                    <td>Distance from bottom (px)</td>
                </tr>
                <tr>
                    <td>position-y</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>bottom</td>
                    <td>top, center, bottom</td>
                </tr>
                <tr>
                    <td>stroke-color</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>#000000</td>
                    <td>Text outline color</td>
                </tr>
                <tr>
                    <td>stroke-width</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>2</td>
                    <td>Text outline width (0–20)</td>
                </tr>
                <tr>
                    <td>highlight-color</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td>Highlight color or <code class="td-code">"auto"</code> for rainbow</td>
                </tr>
                <tr>
                    <td>animation</td>
                    <td><span class="tag tag-array">object</span></td>
                    <td>—</td>
                    <td>Same animation options as Subtitles element</td>
                </tr>
            </table>

            <div class="alert alert-warn">⚠️ Auto-SRT adds processing time (~30–60s per minute of audio on CPU). For
                pre-made subtitles, use the <a href="#el-subtitles" style="color:var(--orange)">Subtitles element</a>
                with an SRT file instead.</div>
        </section>

        <hr class="divider">

        <!-- VISUAL EFFECTS -->
        <section class="section" id="effects">
            <h2>🎬 Visual Effects</h2>
            <p>Apply continuous visual effects to <strong>image</strong> and <strong>video</strong> elements. Effects
                run over the element's duration and can be combined with animations.</p>

            <h4>Effect Properties</h4>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>type</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td><strong>Required.</strong> <code class="td-code">zoom-in</code>, <code
                            class="td-code">zoom-out</code>, <code class="td-code">pan</code>, <code
                            class="td-code">ken-burns</code></td>
                </tr>
                <tr>
                    <td>duration</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>element duration</td>
                    <td>Effect duration in seconds. If omitted, spans the entire element.</td>
                </tr>
                <tr>
                    <td>easing</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>ease-in-out</td>
                    <td><code class="td-code">linear</code>, <code class="td-code">ease-in</code>, <code
                            class="td-code">ease-out</code>, <code class="td-code">ease-in-out</code></td>
                </tr>
                <tr>
                    <td>start-scale</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>1.0</td>
                    <td>Starting zoom scale (zoom/ken-burns). 1.0 = original size.</td>
                </tr>
                <tr>
                    <td>end-scale</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>1.3</td>
                    <td>Ending zoom scale (zoom/ken-burns)</td>
                </tr>
                <tr>
                    <td>direction</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>depends</td>
                    <td>Pan: <code class="td-code">left</code>/<code class="td-code">right</code>/<code
                            class="td-code">up</code>/<code class="td-code">down</code>. Ken Burns: <code
                            class="td-code">in</code>/<code class="td-code">out</code></td>
                </tr>
                <tr>
                    <td>intensity</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>0.15</td>
                    <td>Pan distance as ratio (0.01–0.5). Higher = more movement.</td>
                </tr>
                <tr>
                    <td>x</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>center</td>
                    <td>Ken Burns anchor: <code class="td-code">left</code>, <code class="td-code">center</code>, <code
                            class="td-code">right</code></td>
                </tr>
                <tr>
                    <td>y</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>center</td>
                    <td>Ken Burns anchor: <code class="td-code">top</code>, <code class="td-code">center</code>, <code
                            class="td-code">bottom</code></td>
                </tr>
            </table>

            <h4>Examples</h4>

            <h5>Zoom In</h5>
            <pre>{
  <span class="color-key">"type"</span>: <span class="color-str">"image"</span>,
  <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/photo.jpg"</span>,
  <span class="color-key">"duration"</span>: <span class="color-num">5</span>,
  <span class="color-key">"effect"</span>: { <span class="color-key">"type"</span>: <span class="color-str">"zoom-in"</span>, <span class="color-key">"start-scale"</span>: <span class="color-num">1.0</span>, <span class="color-key">"end-scale"</span>: <span class="color-num">1.3</span> }
}</pre>

            <h5>Pan Left</h5>
            <pre>{
  <span class="color-key">"type"</span>: <span class="color-str">"video"</span>,
  <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/clip.mp4"</span>,
  <span class="color-key">"effect"</span>: { <span class="color-key">"type"</span>: <span class="color-str">"pan"</span>, <span class="color-key">"direction"</span>: <span class="color-str">"left"</span>, <span class="color-key">"intensity"</span>: <span class="color-num">0.2</span> }
}</pre>

            <h5>Ken Burns (cinematic)</h5>
            <pre>{
  <span class="color-key">"type"</span>: <span class="color-str">"image"</span>,
  <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/landscape.jpg"</span>,
  <span class="color-key">"duration"</span>: <span class="color-num">8</span>,
  <span class="color-key">"effect"</span>: {
    <span class="color-key">"type"</span>: <span class="color-str">"ken-burns"</span>,
    <span class="color-key">"direction"</span>: <span class="color-str">"in"</span>,
    <span class="color-key">"x"</span>: <span class="color-str">"left"</span>,
    <span class="color-key">"y"</span>: <span class="color-str">"top"</span>,
    <span class="color-key">"easing"</span>: <span class="color-str">"ease-in-out"</span>
  }
}</pre>

            <div class="alert alert-info">💡 Effects and animations can be combined. Effects control continuous
                movement; animations control enter/exit.</div>
        </section>

        <!-- SUBTITLES -->
        <section class="section" id="el-subtitles">
            <h3>💬 Subtitles Element</h3>
            <p>The most feature-rich element. Supports SRT/ASS files with glow effects and animations.</p>

            <h4>Source</h4>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>src</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>URL to SRT or ASS subtitle file</td>
                </tr>
                <tr>
                    <td>text</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>Inline subtitle text</td>
                </tr>
            </table>

            <h4>Styling</h4>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>font-size</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>32</td>
                    <td>Font size (1–500)</td>
                </tr>
                <tr>
                    <td>color</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>#ffffff</td>
                    <td>Base text color</td>
                </tr>
                <tr>
                    <td>font</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>Montserrat Black</td>
                    <td>Font file path</td>
                </tr>
                <tr>
                    <td>bold</td>
                    <td><span class="tag tag-bool">bool</span></td>
                    <td>false</td>
                    <td>Bold variant</td>
                </tr>
                <tr>
                    <td>stroke-color</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>#000000</td>
                    <td>Outline color</td>
                </tr>
                <tr>
                    <td>stroke-width</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>2</td>
                    <td>Outline thickness (0–20)</td>
                </tr>
            </table>

            <h4>Positioning</h4>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>position-x</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>center</td>
                    <td>left · center · right</td>
                </tr>
                <tr>
                    <td>position-y</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>bottom</td>
                    <td>top · center · bottom</td>
                </tr>
                <tr>
                    <td>top</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>—</td>
                    <td>Offset from top (px)</td>
                </tr>
                <tr>
                    <td>bottom</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>—</td>
                    <td>Offset from bottom (px)</td>
                </tr>
                <tr>
                    <td>left</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>—</td>
                    <td>Offset from left (px)</td>
                </tr>
                <tr>
                    <td>right</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>—</td>
                    <td>Offset from right (px)</td>
                </tr>
            </table>

            <h4>Subtitle Animations</h4>
            <table>
                <tr>
                    <th>Type</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>bounce</td>
                    <td>Pop-in scale effect (0.8x → 1.08x → 1.0x)</td>
                </tr>
                <tr>
                    <td>fade-in</td>
                    <td>Fade from transparent</td>
                </tr>
                <tr>
                    <td>fade-out</td>
                    <td>Fade to transparent</td>
                </tr>
                <tr>
                    <td>fade</td>
                    <td>Fade in + out combined</td>
                </tr>
                <tr>
                    <td>word-by-word</td>
                    <td>Words appear one by one</td>
                </tr>
                <tr>
                    <td>highlight</td>
                    <td>Karaoke-style word coloring</td>
                </tr>
            </table>
        </section>

        <!-- GLOW -->
        <section class="section" id="glow">
            <h2>✨ Glow Effect</h2>
            <p>When <code class="td-code">highlight-color</code> is set on a subtitles element, one random word per line
                gets a neon glow effect.</p>

            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Default</th>
                    <th>Range</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>highlight-color</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td>—</td>
                    <td>—</td>
                    <td><code class="td-code">"auto"</code> = random palette, or hex like <code
                            class="td-code">"#ff0000"</code></td>
                </tr>
                <tr>
                    <td>glow-opacity</td>
                    <td><span class="tag tag-number">number</span></td>
                    <td>0.78</td>
                    <td>0.0–1.0</td>
                    <td>Glow brightness. Higher = more intense</td>
                </tr>
                <tr>
                    <td>glow-blur</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>20</td>
                    <td>0–100</td>
                    <td>Blur radius. Higher = softer/wider glow</td>
                </tr>
                <tr>
                    <td>glow-spread</td>
                    <td><span class="tag tag-number">int</span></td>
                    <td>auto</td>
                    <td>0–100</td>
                    <td>Stroke spread. Default = font-size ÷ 3</td>
                </tr>
            </table>

            <h4>Auto Color Palette</h4>
            <p>When <code class="td-code">highlight-color: "auto"</code>, colors cycle through:</p>
            <div style="display:flex;gap:8px;margin:12px 0;flex-wrap:wrap">
                <span
                    style="background:#ffff00;color:#000;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">Yellow</span>
                <span
                    style="background:#ff3333;color:#fff;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">Red</span>
                <span
                    style="background:#33ff57;color:#000;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">Green</span>
                <span
                    style="background:#33ccff;color:#000;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">Blue</span>
                <span
                    style="background:#ff8c1a;color:#000;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">Orange</span>
                <span
                    style="background:#ff33ff;color:#000;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">Magenta</span>
                <span
                    style="background:#00ffcc;color:#000;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">Teal</span>
                <span
                    style="background:#ff6699;color:#000;padding:4px 12px;border-radius:6px;font-size:12px;font-weight:600">Rose</span>
            </div>

            <h4>Example</h4>
            <pre>{
  <span class="color-key">"type"</span>: <span class="color-str">"subtitles"</span>,
  <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/captions.srt"</span>,
  <span class="color-key">"highlight-color"</span>: <span class="color-str">"auto"</span>,
  <span class="color-key">"glow-opacity"</span>: <span class="color-num">0.7</span>,
  <span class="color-key">"glow-blur"</span>: <span class="color-num">25</span>,
  <span class="color-key">"glow-spread"</span>: <span class="color-num">20</span>
}</pre>
        </section>

        <!-- TRANSITIONS -->
        <section class="section" id="transitions">
            <h2>🔄 Scene Transitions</h2>
            <p>Applied between scenes. Set on the incoming scene.</p>
            <pre>{ <span class="color-key">"transition"</span>: { <span class="color-key">"type"</span>: <span class="color-str">"fade"</span>, <span class="color-key">"duration"</span>: <span class="color-num">0.5</span> } }</pre>
            <table>
                <tr>
                    <th>Type</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>fade</td>
                    <td>Crossfade between scenes</td>
                </tr>
                <tr>
                    <td>dissolve</td>
                    <td>Dissolve effect</td>
                </tr>
                <tr>
                    <td>slide-left</td>
                    <td>New scene slides from right</td>
                </tr>
                <tr>
                    <td>slide-right</td>
                    <td>New scene slides from left</td>
                </tr>
                <tr>
                    <td>slide-up</td>
                    <td>New scene slides from bottom</td>
                </tr>
                <tr>
                    <td>slide-down</td>
                    <td>New scene slides from top</td>
                </tr>
                <tr>
                    <td>zoom-in</td>
                    <td>Zoom in entrance</td>
                </tr>
                <tr>
                    <td>zoom-out</td>
                    <td>Zoom out entrance</td>
                </tr>
                <tr>
                    <td>wipe</td>
                    <td>Wipe transition</td>
                </tr>
            </table>
        </section>

        <!-- ANIMATIONS -->
        <section class="section" id="animations">
            <h2>🎭 Element Animations</h2>
            <p>Applied to any visual element via the <code class="td-code">animation</code> property.</p>
            <pre>{ <span class="color-key">"animation"</span>: { <span class="color-key">"type"</span>: <span class="color-str">"fade-in"</span>, <span class="color-key">"duration"</span>: <span class="color-num">0.5</span>, <span class="color-key">"easing"</span>: <span class="color-str">"ease-out"</span> } }</pre>
            <table>
                <tr>
                    <th>Type</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>fade-in</td>
                    <td>Fade from transparent</td>
                </tr>
                <tr>
                    <td>fade-out</td>
                    <td>Fade to transparent</td>
                </tr>
                <tr>
                    <td>slide-in-left</td>
                    <td>Slide from left edge</td>
                </tr>
                <tr>
                    <td>slide-in-right</td>
                    <td>Slide from right edge</td>
                </tr>
                <tr>
                    <td>slide-in-top</td>
                    <td>Slide from top</td>
                </tr>
                <tr>
                    <td>slide-in-bottom</td>
                    <td>Slide from bottom</td>
                </tr>
                <tr>
                    <td>zoom-in</td>
                    <td>Scale 30% → 100%</td>
                </tr>
                <tr>
                    <td>zoom-out</td>
                    <td>Scale 170% → 100%</td>
                </tr>
                <tr>
                    <td>bounce</td>
                    <td>Bouncing entrance</td>
                </tr>
            </table>
            <h4>Easing Functions</h4>
            <table>
                <tr>
                    <th>Value</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>linear</td>
                    <td>Constant speed</td>
                </tr>
                <tr>
                    <td>ease-in</td>
                    <td>Slow start, fast end</td>
                </tr>
                <tr>
                    <td>ease-out</td>
                    <td>Fast start, slow end (default)</td>
                </tr>
                <tr>
                    <td>ease-in-out</td>
                    <td>Slow start and end</td>
                </tr>
            </table>
        </section>

        <hr class="divider">

        <!-- TEMPLATES -->
        <section class="section" id="list-templates">
            <h2>Templates</h2>
            <p>Save and reuse video payloads as templates.</p>

            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/templates</span>
            </div>
            <p>List your templates + public templates. Paginated.</p>
        </section>

        <section class="section" id="create-template">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/templates</span>
            </div>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>name</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td><span class="required">Yes</span></td>
                    <td>Template name (max 255)</td>
                </tr>
                <tr>
                    <td>description</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td></td>
                    <td>Description (max 1000)</td>
                </tr>
                <tr>
                    <td>category</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td></td>
                    <td>Category label (default: general)</td>
                </tr>
                <tr>
                    <td>is_public</td>
                    <td><span class="tag tag-bool">bool</span></td>
                    <td></td>
                    <td>Make available to all users</td>
                </tr>
                <tr>
                    <td>payload</td>
                    <td><span class="tag tag-array">object</span></td>
                    <td><span class="required">Yes</span></td>
                    <td>Full movie payload</td>
                </tr>
            </table>
        </section>

        <section class="section" id="get-template">
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/templates/{id}</span>
            </div>
            <p>Returns template details including full payload.</p>
        </section>

        <section class="section" id="update-template">
            <div class="endpoint-header">
                <span class="method method-put">PUT</span>
                <span class="path">/api/v1/templates/{id}</span>
            </div>
            <p>Update template. Owner only. All fields optional.</p>
        </section>

        <section class="section" id="delete-template">
            <div class="endpoint-header">
                <span class="method method-delete">DELETE</span>
                <span class="path">/api/v1/templates/{id}</span>
            </div>
            <p>Delete template. Owner only.</p>
        </section>

        <section class="section" id="render-template">
            <h3>Render from Template</h3>
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/templates/{id}/render</span>
            </div>
            <p>Render a video from template with optional overrides (deep-merged).</p>
            <pre>{
  <span class="color-key">"overrides"</span>: {
    <span class="color-key">"scenes"</span>: [{
      <span class="color-key">"elements"</span>: [{ <span class="color-key">"text"</span>: <span class="color-str">"New Title!"</span> }]
    }]
  }
}</pre>
        </section>

        <hr class="divider">

        <!-- WEBHOOKS -->
        <section class="section" id="get-webhook">
            <h2>Webhooks</h2>
            <p>Receive notifications when render jobs complete or fail.</p>

            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/webhooks</span>
            </div>
            <p>Get current webhook configuration.</p>
        </section>

        <section class="section" id="set-webhook">
            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/webhooks</span>
            </div>
            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Default</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>url</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td><span class="required">Yes</span></td>
                    <td>—</td>
                    <td>Webhook URL (max 500)</td>
                </tr>
                <tr>
                    <td>events</td>
                    <td><span class="tag tag-array">array</span></td>
                    <td></td>
                    <td>done, failed</td>
                    <td>render.done · render.failed · render.processing</td>
                </tr>
                <tr>
                    <td>is_active</td>
                    <td><span class="tag tag-bool">bool</span></td>
                    <td></td>
                    <td>true</td>
                    <td>Enable/disable</td>
                </tr>
            </table>
        </section>

        <section class="section" id="del-webhook">
            <div class="endpoint-header">
                <span class="method method-delete">DELETE</span>
                <span class="path">/api/v1/webhooks</span>
            </div>
            <p>Remove webhook configuration.</p>
        </section>

        <hr class="divider">

        <!-- ACCOUNT -->
        <section class="section" id="account">
            <h2>Account</h2>
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/account</span>
            </div>
            <h4>Response</h4>
            <pre>{
  <span class="color-key">"user"</span>: { <span class="color-key">"id"</span>: <span class="color-num">1</span>, <span class="color-key">"name"</span>: <span class="color-str">"Murad"</span>, <span class="color-key">"email"</span>: <span class="color-str">"murad@example.com"</span> },
  <span class="color-key">"plan"</span>: {
    <span class="color-key">"name"</span>: <span class="color-str">"Pro"</span>,
    <span class="color-key">"max_render_minutes"</span>: <span class="color-num">500</span>,
    <span class="color-key">"max_video_duration"</span>: <span class="color-num">600</span>,
    <span class="color-key">"rate_limit_per_minute"</span>: <span class="color-num">30</span>,
    <span class="color-key">"retention_days"</span>: <span class="color-num">30</span>
  },
  <span class="color-key">"usage"</span>: { <span class="color-key">"total_jobs"</span>: <span class="color-num">45</span>, <span class="color-key">"completed_jobs"</span>: <span class="color-num">42</span> }
}</pre>
        </section>

        <hr class="divider">

        <!-- TRANSCRIPTION -->
        <section class="section" id="create-transcribe">
            <h2>Transcription (Audio/Video → SRT)</h2>
            <p>Generate SRT subtitle files from audio or video using AI (OpenAI Whisper). Files expire after 1 hour.</p>

            <div class="endpoint-header">
                <span class="method method-post">POST</span>
                <span class="path">/api/v1/transcribe</span>
            </div>

            <h4>Request Body</h4>
            <pre>{
  <span class="color-key">"src"</span>: <span class="color-str">"https://example.com/voiceover.mp3"</span>,
  <span class="color-key">"language"</span>: <span class="color-str">"az"</span>
}</pre>

            <table>
                <tr>
                    <th>Property</th>
                    <th>Type</th>
                    <th>Required</th>
                    <th>Description</th>
                </tr>
                <tr>
                    <td>src</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td><span class="required">Yes</span></td>
                    <td>URL to audio (MP3, WAV, AAC) or video (MP4, WebM, MOV) file</td>
                </tr>
                <tr>
                    <td>language</td>
                    <td><span class="tag tag-string">string</span></td>
                    <td></td>
                    <td>Language code (<code class="td-code">az</code>, <code class="td-code">en</code>, <code
                            class="td-code">tr</code>, <code class="td-code">ru</code>…). If omitted, auto-detected.
                    </td>
                </tr>
            </table>

            <div class="alert alert-info">💡 Specifying <code class="td-code">language</code> improves accuracy. Omit it
                for auto-detection (99 languages supported).</div>

            <h4>Response — <span class="status status-202">202 Accepted</span></h4>
            <pre>{
  <span class="color-key">"job_id"</span>: <span class="color-str">"019d3a12-4b5c-..."</span>,
  <span class="color-key">"status"</span>: <span class="color-str">"queued"</span>,
  <span class="color-key">"src_type"</span>: <span class="color-str">"audio"</span>,
  <span class="color-key">"created_at"</span>: <span class="color-str">"2026-03-28T09:35:00+00:00"</span>
}</pre>
        </section>

        <section class="section" id="get-transcribe">
            <div class="endpoint-header">
                <span class="method method-get">GET</span>
                <span class="path">/api/v1/transcribe/{job_id}</span>
            </div>

            <h4>Response — Done</h4>
            <pre>{
  <span class="color-key">"job_id"</span>: <span class="color-str">"019d3a12-..."</span>,
  <span class="color-key">"status"</span>: <span class="color-str">"done"</span>,
  <span class="color-key">"language"</span>: <span class="color-str">"az"</span>,
  <span class="color-key">"language_confidence"</span>: <span class="color-num">0.94</span>,
  <span class="color-key">"segments"</span>: <span class="color-num">18</span>,
  <span class="color-key">"srt_url"</span>: <span class="color-str">"http://168.231.108.200:2993/renders/srt/019d3a12-....srt"</span>,
  <span class="color-key">"completed_at"</span>: <span class="color-str">"2026-03-28T09:35:42+00:00"</span>,
  <span class="color-key">"expires_at"</span>: <span class="color-str">"2026-03-28T10:35:42+00:00"</span>
}</pre>

            <div class="alert alert-warn">⚠️ SRT files expire after <strong>1 hour</strong>. Download or use the URL
                before expiry.</div>
        </section>

        <div style="text-align:center;padding:48px 0;color:var(--text2);font-size:13px">
            JSON2Video API v1 · Built with ❤️
        </div>
    </main>

    <script>
        // Active nav link highlight
        const sections = document.querySelectorAll('.section');
        const navLinks = document.querySelectorAll('.nav-link');
        window.addEventListener('scroll', () => {
            let current = '';
            sections.forEach(s => { if (window.scrollY >= s.offsetTop - 100) current = s.id; });
            navLinks.forEach(l => {
                l.classList.remove('active');
                if (l.getAttribute('href') === '#' + current) l.classList.add('active');
            });
        });
        // Smooth scroll
        navLinks.forEach(l => l.addEventListener('click', e => {
            if (window.innerWidth < 900) document.querySelector('.sidebar').classList.remove('open');
        }));
    </script>
</body>

</html>