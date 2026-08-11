# AlMotion — Project Overview (auto-loaded by Claude Code)

This file is a high-density brief for any new chat session working on AlMotion. Read this first, then load the detailed reference docs in `.docs/` only when needed.

---

## What is AlMotion?

Browser-based, AI-assisted multi-track video editor (formerly FreeCut, branded "alMotion AI"). Two parts:

- **Frontend** — `freecut/` — React 19 + TypeScript + Vite SPA. WebGPU effects, WebCodecs export, OPFS/IndexedDB persistence, browser Whisper. **Almost the entire editor (timeline, preview, effects, export, keyframes, composition, player) is purely client-side.** GitHub: `walterlow/freecut.git`.
- **Backend** — `freecut-backend/` — Laravel 12 SaaS layer (Sanctum auth, plans, Stripe billing, MCP server, AI proxies). **In git** (same repo). Adds auth/plans/persistence/AI integrations on top of FreeCut.

The backend wraps four AI services: OpenAI (chat + Whisper), HeyGen (AI avatars), WaveSpeed (AI B-roll), and a json2video transcription proxy.

---

## Repo layout

```
AlMotion/
├── freecut/              # Frontend (React 19 + Vite, in git → walterlow/freecut.git)
│   ├── CLAUDE.md         # Detailed FRONTEND architecture (read for editor internals)
│   ├── src/
│   │   ├── features/     # editor, timeline, preview, player, composition-runtime,
│   │   │                 # export, effects, keyframes, media-library, project-bundle,
│   │   │                 # projects, settings, auth, layout, admin
│   │   ├── infrastructure/
│   │   │   ├── api/      # api-client.ts, project-api.ts, chat-api.ts (talk to Laravel)
│   │   │   ├── ai/       # openai-service.ts, ai-tool-executor.ts (HeyGen + WaveSpeed)
│   │   │   ├── external/ # pexels-service.ts (direct CDN)
│   │   │   ├── storage/  # IndexedDB schema/connection
│   │   │   └── gpu/      # WebGPU facades
│   │   ├── routes/       # TanStack Router (login, register, projects, editor, settings,
│   │   │                 # agents, admin/*)
│   │   ├── domain/timeline/
│   │   ├── lib/          # gpu-effects, gpu-transitions, gpu-compositor, fonts, ...
│   │   └── shared/       # logging, state, utils
│   └── vite.config.ts    # Proxies /api/v1 → 127.0.0.1:8000/api (rewrite)
├── freecut-backend/      # Backend (Laravel 12, in git)
│   ├── app/
│   │   ├── Http/Controllers/Api/  # Auth, Projects, Media, Transcript,
│   │   │                          # ChatMessage, ChatSession, OpenAi,
│   │   │                          # HeyGen, WaveSpeed, UserSettings,
│   │   │                          # Agent, Admin/*
│   │   ├── Http/Middleware/       # AdminMiddleware, CheckPlanLimits
│   │   └── Models/                # User, Plan, Project, MediaFile, ChatMessage,
│   │                              # ChatSession, Agent, Setting, TokenUsage,
│   │                              # Transcript, UserAvatar
│   ├── routes/api.php             # All API routes (Laravel auto-prefixes /api)
│   ├── database/migrations/       # 21 migrations
│   ├── database/database.sqlite   # Dev DB (gitignored — create + migrate per machine)
│   └── .env                       # ⚠️ Contains real OPENAI_API_KEY, APP_DEBUG=true
└── .docs/                # Detailed reference (load on demand)
    ├── 01-backend-audit.md       # Full route table, models, middleware, gotchas
    ├── 02-integration-map.md     # Every frontend ↔ backend endpoint
    └── 03-domain-and-flows.md    # Plans, agents, AI integrations, user journey
```

---

## How to start (Coder workspace, no PHP installed by default)

PHP and Composer are NOT in PATH — we use FrankenPHP wrapper at `~/.local/bin/php` (Composer at `~/.local/bin/composer`).

```bash
export PATH="$HOME/.local/bin:$PATH"

# Backend (port 8000)
cd ~/workspace/AlMotion/freecut-backend
nohup ~/.local/bin/frankenphp php-server --listen=:8000 --root=public > /tmp/backend.log 2>&1 &
disown

# Frontend (port 5273 — chosen because user has another project on local 5173)
cd ~/workspace/AlMotion/freecut
nohup npx vite --host --port 5273 > /tmp/frontend.log 2>&1 &
disown
```

Stop: `pkill -f frankenphp; pkill -f vite`

User accesses via VSCode PORTS panel forwarding `5273` → their local browser.

If frontend port crash: `npm install @rollup/rollup-linux-x64-gnu --no-save` and `npm install lucide-react@0.468.0 --no-save` (known node_modules quirks fixed before).

---

## API surface (high-level)

All under `/api` prefix. Auth via Sanctum bearer token (never expires, no abilities).

- **Auth**: register, login, logout, me
- **Projects**: REST CRUD (POST gated by `plan.limit:projects`)
- **Media**: REST CRUD + transcripts (POST upload gated by `plan.limit:storage`) — *but frontend doesn't actually use upload route; media lives in OPFS/IndexedDB*
- **Chat sessions**: REST CRUD with paginated messages (legacy flat `chat_messages` route still exists, unused)
- **AI proxies**: `/openai/chat` (token-metered), `/openai/transcribe` (Whisper), `/transcribe/start|status|srt` (json2video)
- **HeyGen**: avatars, voices, videos, proxy-image (public!)
- **WaveSpeed**: generate, status (B-roll)
- **User settings**: own OpenAI + HeyGen keys
- **Agents**: REST CRUD (global + own)
- **Admin** (`/admin/*`): dashboard, plans, users, settings, ai-config, agents

Full table with file:line refs in [.docs/01-backend-audit.md](.docs/01-backend-audit.md) and consumer map in [.docs/02-integration-map.md](.docs/02-integration-map.md).

---

## Storage strategy split

| Where | What |
|---|---|
| **OPFS** (browser) | Actual media file bytes, waveform multi-resolution caches |
| **IndexedDB** (browser, via `idb`) | Media metadata, thumbnails, transcripts, waveform peaks, GIF frames, decoded preview audio, content-addressed dedup |
| **localStorage** | Only `auth-storage` (Zustand persist key) + small Zustand stores |
| **Cache API** | HuggingFace ONNX models (Kitten TTS) |
| **Backend (SQLite)** | User accounts, projects + `timeline_data` JSON, chat sessions/messages, transcripts mirror, plans, settings, token usage |

**Backend is source of truth for project metadata + timeline JSON.** Local IndexedDB has `project-local-data` for non-syncable bits (file handles for re-linking media). Re-opening a project on another device requires user to re-link via File System Access API picker.

---

## Plans (seeded)

| Plan | max_projects | storage_mb | tokens/mo | price |
|---|---|---|---|---|
| **Free** (default) | 3 | 500 | 50,000 | $0 |
| **Pro** | 25 | 10,000 | 500,000 | $9.99 |
| **Business** | 100 | 50,000 | 2,000,000 | $29.99 |

Plus capability flags (per migration): `can_use_own_api_key`, `allowed_models`, `can_generate_broll`, `can_create_agents` + `max_agents`, `can_use_heygen` + `max_heygen_credits_monthly` + `can_create_avatars` + `can_use_own_heygen_key`.

⚠️ **New users sign up with `plan_id=NULL`** (`AuthController::register` doesn't set it) — they silently get the most-restrictive `CheckPlanLimits` defaults.

---

## API key sourcing

| Service | Source priority |
|---|---|
| OpenAI | user own → admin Setting → env |
| HeyGen | user own only (no fallback, even though admin setting exists) |
| WaveSpeed | admin Setting only |
| Pexels | admin Setting (passed to client via `/user/ai-config`!) |
| json2video | **Hardcoded in source** (backend + frontend duplicated) |

---

## Hardcoded URLs / keys to know about

These are baked into the bundle and need to change for production deploy:

| File:line | Value |
|---|---|
| `freecut/src/features/media-library/services/json2video-service.ts:79` | `http://168.231.108.200:2993` (stripped from SRT) |
| `freecut/src/features/media-library/services/json2video-service.ts:128` | `j2v_mbnW39bhYRc7UXkevMSOctKnd1acIQXY` |
| `freecut-backend/app/Http/Controllers/Api/OpenAiController.php:84,98,108,113` | Same j2v IP + key |
| `freecut-backend/.env:7` | Real OpenAI key (`sk-proj-Y0rNDJzZ9zXh…`) |

The frontend `localhost:8000` hardcodes are **gone** — `api-client.ts` now uses a relative
`/api/v1` base, which Vite proxies in dev and Caddy rewrites in prod. Only the j2v host/key
above remain hardcoded.

**Recommendation:** rotate the OpenAI + j2v keys.

---

## Production deployment (VPS)

Live at **https://almotion.tural.ai**, code at `/opt/almotion` (git clone, `git pull` works).

```
Internet → Caddy (auto-TLS)
   ├── /api/*      → reverse_proxy http://localhost:8206   (php artisan serve)
   ├── /storage/*  → Laravel (uploaded media)
   └── everything else → freecut/dist/  (static SPA)
```

- Backend `.env` needs `APP_URL=https://almotion.tural.ai` — `MediaFile::getUrlAttribute`
  composes media URLs from it directly, and `bootstrap/app.php` trusts Caddy's
  `X-Forwarded-Proto` so generated URLs are https.
- The **`Caddyfile` in this repo is NOT the production one** — it targets the old Coder
  workspace (`/home/coder/workspace`, port 8008, `auto_https off`). The real one lives on
  the VPS, outside the repo.
- Frontend-only change → `git pull && cd freecut && npm ci && npm run build`. No backend
  restart, no migration, no Caddy reload. Build needs ~2-3 GB RAM; on a small VPS build
  locally and `rsync` `freecut/dist/` instead.
- `php artisan serve` is a dev server (single-threaded) and how it stays alive on the VPS is
  **not yet known** — no systemd unit has been confirmed. Worth replacing with FrankenPHP or
  PHP-FPM.

---

## Missing composer dependencies (blocker)

`composer.json` lists only `laravel/framework`, `sanctum`, `tinker` — but the code imports:

- `Stripe\Stripe`, `StripeClient`, `Webhook` in `StripeController` → needs **`stripe/stripe-php`**
- `Laravel\Socialite\Facades\Socialite` in `SocialAuthController` → needs **`laravel/socialite`**

Neither is in `composer.lock`. Every Stripe route and Google OAuth **fatals** until installed.
`.env` also lacks `STRIPE_*`, `GOOGLE_*`, `FRONTEND_URL`, `YTDLP_PATH` (see `config/services.php`).

---

## Editor internals (frontend)

Full architecture documented in [freecut/CLAUDE.md](freecut/CLAUDE.md). Key invariants:

- **Timeline store split**: `useTimelineStore` is a facade over domain stores (items, transitions, keyframes, markers, settings, command). Components use facade with selectors; actions access domain stores via `.getState()`.
- **Timeline mutations**: action modules in `features/timeline/stores/actions/*.ts` use `execute()` wrapper for undo/redo. Never mutate stores directly.
- **Item types**: discriminated union on `type`: `video | audio | text | image | shape | adjustment | composition`. GIFs use `image` type.
- **Frame positioning**: Remotion convention — `from` (start frame in project FPS) + `durationInFrames`.
- **Effects are WebGPU shaders with a CSS fallback.** 39 GPU effects in `src/lib/gpu-effects/`.
  When `requestAdapter()` yields no device, `src/lib/gpu-effects/css-fallback.ts` re-renders the
  10 that have exact CSS equivalents (brightness, contrast, saturation, grayscale, sepia, invert,
  hue-shift, exposure, gaussian/box blur). The other 29 stay inactive by design — approximating
  them would diverge from export. Import via `@/infrastructure/gpu/effects`.
- **Three preview render paths must agree** — a change to one usually needs the others:
  1. **DOM composition** (idle) — `item-visual-wrapper.tsx` reads `state.cssFilter` from
     `use-item-visual-state.ts`
  2. **Fast-scrub canvas** (mouse over timeline, playback) — `client-render-engine.ts`
  3. **GPU effects overlay** (forced on when an item has effects) — `use-gpu-effects-overlay.ts`,
     now suppressed entirely when there is no GPU device, since it would paint over path 1
- **Transitions are NOT GPU-dependent** — they render through DOM/CSS (opacity + transform) and
  keep working with no adapter. This is why transitions can work while effects appear broken.
- **Keyframes are plain interpolation** — no GPU involved.
- **Source-native FPS**: `sourceStart`/`sourceEnd`/`sourceDuration` are in source-native FPS, not project FPS.
- **Track order**: lower value = visually higher (top of timeline).
- **Path alias**: `@/*` → `src/*`
- **`__DEBUG__` API**: dev-only window debugger with `stores()`, `getTransitions()`, `jitter()`, etc.
- **Feature boundaries**: features must NOT import `@/lib/*` directly — use `@/infrastructure/` facades. Pre-push hook enforces.

---

## Known issues (beware before proposing fixes)

1. Two transcript backends coexist — `media_files.transcript_data` is dead column, real path is `transcripts` table keyed on `(project_id, frontend_uuid)`.
2. Two chat backends coexist — frontend uses sessions only; legacy `chat_messages` routes remain.
3. Backend media upload route unreferenced from main editor flow.
4. `transcribeProxy` discards `language` form-field (bug).
5. OpenAI proxy is buffered, no streaming.
6. HeyGen admin key declared but unused — only user-key path works.
7. Token reset is rolling 30 days, not calendar-monthly. HeyGen credits never reset.
8. ~~New users land on `plan_id=NULL`~~ — **fixed**, `AuthController::register` assigns the
   default free plan and applies `trial_days`.
9. SQLite — fine for dev, will hurt under concurrent uploads in prod.
10. No queue workers; all third-party calls synchronous (timeouts up to 300s). `yt-dlp` import
    runs inline and expects the binary at `/opt/almotion/bin/yt-dlp`.
11. **Backend has no tests** — only Laravel scaffolding. Frontend has ~205 test files.
    Pre-existing red on `main`: `check:boundaries` (11 cross-feature imports),
    `timeline-store-facade.test.ts` (10), `scene-assembly.test.ts` (2), ~144 `tsc` errors.
    `npm run build` uses esbuild and passes regardless — don't mistake these for your break.
12. Frontend Vite proxy `/api/v1` → `/api` rewrite — but Laravel route `/api/transcribe/start` is not `/api/transcribe`. **Path mismatch may silently break json2video** unless the proxy is meant to point to remote j2v host.
13. Locale: AI chat panel has Azerbaijani strings in interim messages.

---

## Workflow

- **Dev**: VSCode PORTS forwarding from Coder workspace.
- **Backend on**: 8000. **Frontend on**: 5273 (chosen to avoid local 5173 conflict on user's Windows machine).
- **DB migrations**: already applied. To re-run: `php artisan migrate:fresh --seed` (will wipe).
- **Seeded admin**: `murad.cafarzada212@gmail.com` / `admin123456` (weak — change before any deploy).
- **Logs**: `/tmp/backend.log`, `/tmp/frontend.log`, `freecut-backend/storage/logs/laravel.log`.

---

## Next up (agreed with the user, not started)

### 1. Media must live on the server, not on the user's disk

Today media is bound to **File System Access handles** pointing at files on whichever machine
imported them. Opening the project elsewhere shows "N Missing", and re-granting permission
fails because `requestPermission` is called without a user gesture
(`SecurityError: User activation is required`) — so the current relink path can never succeed
on its own. Meanwhile the plans sell storage that goes unused.

The backend half already exists: `MediaUploadController` (signed-URL PUT + finalize),
`MediaImportController`, `media_upload_sessions`, `users.storage_used`, `plan.limit:storage`,
and commit `8a2627d` ("cross-device media sync"). It is wired as a **background backup**, not
the source of truth.

Work: make import upload to the server first and treat OPFS as a cache; reorder
`resolveMediaUrl` to cache → server URL and drop the handle path; enforce the storage limit at
import with a clear message; remove the broken-media/relink flow; one-off migration for
existing handle-bound projects. **Risk: user files — do not rush this.**
Note: 500 MB (free plan) is ~5 minutes of 1080p; the plan tiers need rethinking alongside VPS disk.

### 2. "Animation" section — Pan & Zoom / Ken Burns

Build on the existing keyframe system (`src/features/keyframes/`), **not** as a shader — pan/zoom
is a transform over time, so it needs no GPU and works on machines with no adapter. A preset
button writes two keyframes (scale/position at clip start and end) that the user can then edit by
hand, and export already understands keyframes.

Presets: Zoom In, Zoom Out, Pan L→R / R→L / T→B / B→T, Ken Burns (zoom + pan), with intensity
and easing controls (default ease-in-out). Place it as its own section in the properties sidebar
(`features/editor/components/properties-sidebar/clip-panel/index.tsx`), next to Effects.

---

## When making changes

- Read [freecut/CLAUDE.md](freecut/CLAUDE.md) for editor invariants before touching timeline/preview/effects.
- Read [.docs/01-backend-audit.md](.docs/01-backend-audit.md) for backend internals.
- Read [.docs/02-integration-map.md](.docs/02-integration-map.md) before proposing API changes — to know all consumers.
- Read [.docs/03-domain-and-flows.md](.docs/03-domain-and-flows.md) for plan/agent/AI flow details.
