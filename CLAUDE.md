# AlMotion — Project Overview (auto-loaded by Claude Code)

This file is a high-density brief for any new chat session working on AlMotion. Read this first, then load the detailed reference docs in `.docs/` only when needed.

---

## What is AlMotion?

Browser-based, AI-assisted multi-track video editor (formerly FreeCut, branded "alMotion AI"). Two parts:

- **Frontend** — `freecut/` — React 19 + TypeScript + Vite SPA. WebGPU effects, WebCodecs export, OPFS/IndexedDB persistence, browser Whisper. **Almost the entire editor (timeline, preview, effects, export, keyframes, composition, player) is purely client-side.** GitHub: `walterlow/freecut.git`.
- **Backend** — `freecut-backend/` — Laravel 12 SaaS layer (Sanctum auth, plans, AI proxies). **NOT in git.** Adds auth/plans/persistence/AI integrations on top of FreeCut.

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
├── freecut-backend/      # Backend (Laravel 12, NOT in git)
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
│   ├── database/database.sqlite   # Dev DB (already migrated)
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
| `freecut/src/infrastructure/api/api-client.ts:1` | `http://localhost:8000/api` (base URL) |
| `freecut/src/infrastructure/ai/openai-service.ts:23` | `http://localhost:8000/api/openai/chat` |
| `freecut/src/infrastructure/ai/ai-tool-executor.ts:836,985,997` | `http://localhost:8000/api/heygen/proxy-image` |
| `freecut/src/features/media-library/services/json2video-service.ts:79` | `http://168.231.108.200:2993` (stripped from SRT) |
| `freecut/src/features/media-library/services/json2video-service.ts:128` | `j2v_mbnW39bhYRc7UXkevMSOctKnd1acIQXY` |
| `freecut-backend/app/Http/Controllers/Api/OpenAiController.php:84,98,108,113` | Same j2v IP + key |
| `freecut-backend/.env:7` | Real OpenAI key (`sk-proj-Y0rNDJzZ9zXh…`) |

**Recommendation:** introduce `VITE_API_BASE_URL` env var; rotate the OpenAI + j2v keys.

---

## Editor internals (frontend)

Full architecture documented in [freecut/CLAUDE.md](freecut/CLAUDE.md). Key invariants:

- **Timeline store split**: `useTimelineStore` is a facade over domain stores (items, transitions, keyframes, markers, settings, command). Components use facade with selectors; actions access domain stores via `.getState()`.
- **Timeline mutations**: action modules in `features/timeline/stores/actions/*.ts` use `execute()` wrapper for undo/redo. Never mutate stores directly.
- **Item types**: discriminated union on `type`: `video | audio | text | image | shape | adjustment | composition`. GIFs use `image` type.
- **Frame positioning**: Remotion convention — `from` (start frame in project FPS) + `durationInFrames`.
- **Effects/transitions are GPU-only** — all WebGPU shaders. Legacy CSS-based ones removed in v6 migration.
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
8. New users land on `plan_id=NULL` (no auto-default).
9. SQLite — fine for dev, will hurt under concurrent uploads in prod.
10. No queue workers; all third-party calls synchronous (timeouts up to 300s).
11. No tests written (only Laravel scaffolding).
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

## When making changes

- Read [freecut/CLAUDE.md](freecut/CLAUDE.md) for editor invariants before touching timeline/preview/effects.
- Read [.docs/01-backend-audit.md](.docs/01-backend-audit.md) for backend internals.
- Read [.docs/02-integration-map.md](.docs/02-integration-map.md) before proposing API changes — to know all consumers.
- Read [.docs/03-domain-and-flows.md](.docs/03-domain-and-flows.md) for plan/agent/AI flow details.
