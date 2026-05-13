# AlMotion — Domain & User Flows

Generated 2026-05-06. What the app actually does.

---

## 1. Product Summary

AlMotion (formerly FreeCut, branded "alMotion AI" in marketing copy at `freecut/src/routes/index.tsx:112`) is a browser-based, AI-assisted multi-track video editor. Frontend is React 19 + TypeScript + Vite SPA forked from open-source FreeCut. All core media work (decode, GPU effects, transitions, scopes, WebCodecs export, OPFS/IndexedDB persistence, local Whisper transcription) runs **client-side** using WebGPU, WebCodecs, OPFS, and File System Access API.

Layered on top is a **Laravel 12 SaaS backend** that adds:
- Sanctum authentication
- Tier-based plans
- Server-side project/media/transcript persistence
- Admin dashboard
- AI feature proxies:
  - OpenAI chat-completions proxy (token-metered, in-editor agent panel)
  - OpenAI Whisper proxy + separate `json2video` transcription pipeline
  - WaveSpeed AI B-roll generator (Bytedance "Seedance" text-to-video)
  - HeyGen integration for AI avatar talking-head videos

Positioning: "edit videos with alMotion AI" — freemium browser editor with conversational AI that can drive the timeline.

---

## 2. User Roles & Plans

### Plans (`plans` table, Plan model in `app/Models/Plan.php`)

`DatabaseSeeder.php:14-40` creates three:
| Plan | max_projects | max_storage_mb | max_ai_tokens_monthly | price |
|---|---|---|---|---|
| **Free** (`is_default=true`) | 3 | 500 | 50,000 | 0 |
| **Pro** | 25 | 10,000 | 500,000 | $9.99 |
| **Business** | 100 | 50,000 | 2,000,000 | $29.99 |

### Plan capability flags (per migrations)
- `can_use_own_api_key` — BYO OpenAI key
- `allowed_models` JSON — OpenAI models per plan
- `can_generate_broll` — WaveSpeed
- `can_create_agents` + `max_agents` — custom agent personas
- `can_use_heygen` + `max_heygen_credits_monthly` + `can_create_avatars` + `can_use_own_heygen_key`

### User role
Single privilege: **`is_admin` boolean**. No multi-role system. Gates entire `admin/*` route group via `AdminMiddleware`.

### Block system
`is_blocked` flag. Set via `POST /admin/users/{id}/toggle-block` (refuses on admins). Enforced **only** in `CheckPlanLimits` middleware (`:19-22`) — routes without `plan.limit` won't refuse blocked user. Soft-locks: user remains logged in but cannot create projects, upload, call AI proxy, etc.

---

## 3. Project Domain

`Project` model (`app/Models/Project.php`):
- `user_id` (cascade-on-delete owner)
- `name`, `description`
- `width=1920, height=1080, fps=30, background_color=#000000`
- `timeline_data` JSON — full serialized timeline state from frontend
- `settings` JSON

Relations: `user()`, `mediaFiles()` (cascade), `chatMessages()` (legacy), `chatSessions()`.

`ProjectController`: standard REST CRUD; `index` returns user projects with `mediaFiles` count; `show` eager-loads `mediaFiles` AND `chatMessages` (legacy — heavy on long chats). `POST /projects` gated by `plan.limit:projects`.

**Frontend persistence:** Timeline lives in Zustand at runtime, IndexedDB locally, backend `timeline_data` JSON column is the sync target. `mergeWithLocalData()` in `project-store.ts:75-94` merges local-only fields (file handles, schema version).

---

## 4. Media Files & Transcripts

### MediaFile
`app/Models/MediaFile.php`. Fields: `user_id, project_id, name, type (video/audio/image), mime_type, path, thumbnail_path, size, duration (ms), width, height, hash (SHA-256 dedup), transcript_data` (JSON, mostly dead).

### Upload handling
`MediaFileController::store` accepts `file` (max 500 MB) + `type`, stores via Laravel `public` disk under `media/{userId}/{projectId}/...`, computes SHA-256, increments `users.storage_used`. Gated by `plan.limit:storage`.

**The frontend doesn't use this for normal media.** Imports go through `mediaLibraryService.importMediaBlob` → OPFS + IndexedDB. Backend upload appears to be ancillary (e.g. AI-imported broll where blob exists, or future server-rendered exports).

### Transcripts — TWO storage strategies coexist
1. **Project-scoped** in `transcripts` table. `(project_id, media_id)` unique where `media_id` is the **frontend IndexedDB UUID**, NOT `media_files.id`. `TranscriptController` is pure persistence. **This is the active path.**
2. **Per-MediaFile** mirror in `media_files.transcript_data` JSON column with `MediaFileController::saveTranscript`/`getTranscript` — **methods are unrouted dead code**.

### Transcription engines — THREE paths
The frontend has three transcription paths and uses #3 by default:
1. **Browser Whisper** (`@huggingface/transformers` Whisper worker, `freecut/src/features/media-library/transcription/workers/whisper.worker.ts`) — original FreeCut WebGPU-Whisper path. Models: tiny/base/small/large-v3-turbo.
2. **OpenAI Whisper** via backend proxy `POST /openai/transcribe` → `OpenAiController::transcribe`. Token-metered (`duration * 100`).
3. **json2video (default)** — `OpenAiController::transcribeProxy/transcribeStatus` proxy `http://168.231.108.200:2993/api/v1/transcribe` with hardcoded API key `j2v_mbnW39bhYRc7UXkevMSOctKnd1acIQXY`. The same key is duplicated in frontend `json2video-service.ts:128`. Frontend `Json2VideoService` is what `MediaTranscriptionService` actually calls.

---

## 5. Chat — Legacy vs Sessions

### Legacy: flat ChatMessage per project
Model `ChatMessage`. Fields `user_id, project_id, role enum (user/assistant/system), content, tool_calls JSON, tool_results JSON, tokens_used`. `ChatMessageController` exposes `GET/POST /projects/{p}/chat`, `DELETE /chat/{id}`. **All messages for a project sit in one timeline.**

### Newer: ChatSession
Model `ChatSession`. Fields `user_id, project_id, title (default "New Chat", auto-set from first user message — 60 chars truncated)`. `ChatMessage.session_id` nullable FK added in same migration so `chat_messages` table is shared.

`ChatSessionController` provides full CRUD + paginated `messages` + `storeMessage`.

### Frontend behavior
**Uses ONLY the session-based system.** `useAiChatStore` defines both APIs but `AiChatPanel` only wires session methods. On project open: loads sessions, creates new or switches to most recent. Legacy `chat_messages` rows still exist for back-compat (and `Project::chatMessages()` still eager-loads on show), but **no UI path writes to it now**.

---

## 6. Agents (AI Personas)

`Agent` model. Fields: `name, description, system_prompt, allowed_tools (JSON array; null = all), icon (lucide name), is_global (bool), user_id (creator, nullable)`.

### Global vs user agents
- **Global**: admin-managed via `Admin\AgentController` (under `/admin/agents`). New ones get `is_global=true, user_id=null`.
- **User**: created by users via `AgentController::store`. Checks `plan.can_create_agents` + `max_agents` quota. Writes `is_global=false, user_id=$user->id`. Users can only edit/delete own.

### Listing & usage
`AgentController::index` returns `WHERE is_global=true OR user_id=$user->id`, decorated with `is_own` boolean. Frontend chat panel fetches `/agents` on mount. When user picks an agent:
- System prompt = `admin base prompt + admin rules + agent system_prompt`
- Tool list filtered to `allowed_tools` if set

**Frontend UI**: agent CRUD at `freecut/src/routes/agents/{index,new,$agentId}.tsx`; admin global-agent UI at `routes/admin/agents.tsx`.

---

## 7. OpenAI Integration

`OpenAiController.php`. Constants:
- `ALL_MODELS = [gpt-4.1, gpt-4.1-mini, gpt-4o, gpt-4o-mini, o4-mini, o3-mini]`
- `DEFAULT_PLAN_MODELS = ['gpt-4o-mini']` (fallback)

### `/openai/chat` (proxy)
Resolves OpenAI key via 3-tier fallback (own → admin Setting → env). Validates model against `getAllowedModels`:
- For users on platform key: plan's `allowed_models`
- For users on own key: global `Setting::get('user_key_allowed_models')` or `ALL_MODELS`

Forwards **raw request body** to OpenAI chat-completions. **No streaming** — `Http::post` is buffered. Records `TokenUsage` row + increments `tokens_used_this_month`.

### `/openai/transcribe`
Multipart proxy to Whisper-1 with `verbose_json` + segment timestamps, max 25 MB. Token usage **estimated** as `duration * 100`.

### `/user/ai-config`
Returns:
- `available_models` (resolved per user)
- `default_model`
- `using_own_key`
- `pexels_api_key` (used by `search_and_import_pexels` AI tool — passed to client)
- `ai_system_prompt`, `ai_rules`, `ai_tool_descriptions` — all admin-configurable from Admin AI Config UI

Frontend builds effective system prompt (`ai-chat-panel.tsx:212-242`).

### Token enforcement
`CheckPlanLimits:tokens` on `/openai/chat` and `/openai/transcribe`:
- Calls `resetTokensIfNeeded` (rolling 30-day reset, NOT calendar-monthly)
- 429 if `tokens_used_this_month >= max_ai_tokens_monthly`
- Also enforces `is_blocked`

### TokenUsage
`TokenUsage` table stores per-call rows: `service, model, prompt_tokens, completion_tokens, total_tokens, endpoint`. Aggregated for admin dashboard + per-user view.

---

## 8. HeyGen Integration (AI Avatars)

`HeyGenController.php`:
- `config` — plan flags + key status + monthly credits
- `listAvatars` — v2/avatars
- `listAvatarLooks` — v3/avatars/looks (filtered to non-empty `supported_api_engines`)
- `createAvatar` — uploads photo to v2/photo_avatar (10 MB max), records in `user_avatars` table (since users may share a single HeyGen account)
- `listVoices` — v2/voices
- `createVideo` — v2/video/generate, builds `video_inputs` payload with avatar_id + script + voice_id + dimensions from aspect_ratio (9:16/16:9/1:1)
- `getVideo` — v1/video_status.get; on `completed` increments `heygen_credits_used_this_month` by `ceil(duration)`
- `proxyImage` — **public, unauthenticated**. Streams HeyGen images through backend with `Cross-Origin-Resource-Policy: cross-origin`

### API key configuration
**Bring-your-own per user. Always.** `resolveApiKey` requires `$user->own_heygen_api_key` and aborts 500 otherwise. `checkHeygenAccess` requires both `plan.can_use_heygen` AND user-level key.

There's also admin-side `heygen_api_key` setting in admin UI but **no code falls back to it** — that's an inconsistency / dead path.

---

## 9. WaveSpeed Integration (AI B-roll)

`WaveSpeedController.php`. **Single hardcoded model** `bytedance/seedance-v1-pro-fast`. Base `https://api.wavespeed.ai/api/v3`.

- `generate` — gated by `plan.can_generate_broll`. **Admin-only key** (`Setting::get('wavespeed_api_key')`) — no per-user key. Validates: `prompt` (≤2000 chars), `resolution` (480p/720p/1080p, default 480p), `duration` (2-12s, default 5s), `aspect_ratio` (21:9/16:9/4:3/1:1/3:4/9:16, default 16:9), `seed`.
- `status` — polls `predictions/{id}/result`
- `config` — flags

### Async flow
AI tool `generate_ai_broll` (`ai-tool-executor.ts:708-779`):
1. Submits request
2. Polls every 3s up to 120 times (6 min)
3. Downloads result URL on `completed`/`succeeded`
4. Imports into local media library as `ai_broll_{timestamp}.mp4` with tags `['ai-broll', prompt[:30]]`

**Plan enforcement server-side. No usage counting on user record** — B-roll is binary capability, not metered.

---

## 10. Settings (Admin + User)

### Admin settings (key/value)
`settings` table — flat `key`/`value` text dictionary. `Setting::get/set` static helpers.

`Admin\SettingsController` keys:
- `openai_api_key` (masked on read)
- `pexels_api_key` (masked) — used by `search_and_import_pexels` AI tool
- `wavespeed_api_key` (masked)
- `heygen_api_key` (masked) — **declared but unused by `HeyGenController`**
- `allow_user_api_keys` ("true"/"false")
- `user_key_allowed_models` (JSON array — for BYOK users)
- `ai_system_prompt`
- `ai_rules` (JSON string array)
- `ai_tool_descriptions` (JSON map: tool name → custom description override)

### User settings (own keys)
`UserSettingsController`:
- `GET /user/settings` returns `can_use_own_api_key`, masked `own_openai_api_key`, `using_own_key`, plus same triple for HeyGen.
- `PUT /user/settings` — updates own key only if `canUserUseOwnKey` resolves true. Helper layers: per-user override (`can_use_own_api_key`, null=inherit) → global `allow_user_api_keys` → plan's `can_use_own_api_key`.

Keys live on `users` table, hidden from JSON via `User::$hidden`.

---

## 11. End-to-End User Journey

| Step | Endpoint(s) | Local-only? | Requires real API key? |
|---|---|---|---|
| 1. Register | `POST /api/auth/register` | Yes | No |
| 2. Login | `POST /api/auth/login` | Yes | No |
| 3. First project | `POST /projects` | Yes | No |
| 4. Upload video | OPFS/IndexedDB (default) OR `POST /projects/{p}/media` | Yes (default) | No |
| 5. Transcribe | json2video proxy (default), Browser Whisper, or OpenAI | json2video needs reachable host (`168.231.108.200:2993`); Browser Whisper offline; OpenAI needs key | json2video has hardcoded key; OpenAI needs key |
| 6. Chat with agent | `POST /openai/chat` + `/agents` + `/user/ai-config` | No | **Requires admin OPENAI_API_KEY or user BYO key** |
| 7. Generate B-roll | `POST /wavespeed/generate` + status | No | **Requires admin `wavespeed_api_key` + plan `can_generate_broll`** |
| 8. HeyGen avatar | `POST /heygen/videos` + status | No | **Requires user's own HeyGen key + plan flags** |
| 9. Assemble in editor | Pure local | Yes | No |
| 10. Export | Pure local (WebCodecs Web Worker) | Yes | No |

**Works without keys:** register/login/project/upload/local Whisper/timeline editing/export.
**Requires real keys:** AI chat (OpenAI), AI B-roll (WaveSpeed), HeyGen avatars, OpenAI Whisper, json2video (hosted IP).

---

## 12. What's Broken / Stub / TODO

### Functional bugs
- **Hardcoded json2video API key in two places** (backend + frontend). Plus hardcoded server IP `http://168.231.108.200:2993`.
- **Dead code in `transcribeProxy`** — `language` form-field built then discarded (rebuild bug).
- **No streaming on OpenAI proxy** — always blocks. Frontend's `OpenAiService.chat` doesn't read SSE either. "Thinking…" UX synthesizes interim messages by string-matching tool names (Azerbaijani locale: "Videonu transkripsiya edirəm…").
- **HeyGen admin key declared but unused**: admin UI writes `heygen_api_key`, `HeyGenController` only checks `$user->own_heygen_api_key`. No platform-key fallback.
- **Naive monthly token reset**: rolling 30-day, drifts off calendar.
- **Whisper token estimate is rough**: `duration * 100`.
- **New users not auto-assigned default plan**: `AuthController::register` doesn't set `plan_id`. Seeder only assigns plan to admin. New signups land on `plan_id=NULL` and silently get most-restrictive `CheckPlanLimits` defaults.
- **Legacy chat endpoints wired but unused by UI** — and `Project::chatMessages()` eager-load on `show` remains.
- **Backend upload path unreferenced** from editor's main media flow. `users.storage_used` and `media_files` table will be largely empty for normal use.
- **`Admin\UserController::index` `orWhere` not grouped** — search will leak past WHERE constraints (admin-only, but bug).
- **One real `TODO`**: `freecut/src/lib/analysis/gemma-scene-worker.ts:17` — replace CDN imports with bundled devDep.
- **Marketing comment** `// SaaS Transition: Point to our Laravel Backend API Proxy` (`openai-service.ts:23`) — production needs config flag.
- **`debug_srt.js`** at frontend root — leftover dev script.

### Security
- Real OpenAI API key committed in `.env:7`
- `APP_DEBUG=true` in dev (leaks stack traces)
- Hardcoded j2v API key (backend + frontend)
- `/api/transcribe/srt` SSRF
- `/api/heygen/proxy-image` public + loose substring check
- CORS wide open
- Pexels key leaked to client via `/user/ai-config`
- Sanctum tokens never expire
- No rate limiting beyond plan counters
- Seeded admin password `admin123456`

---

## Where Each Key Comes From

| Service | Source priority |
|---|---|
| OpenAI (chat) | user.own_openai_api_key (if `canUserUseOwnKey`) → Setting('openai_api_key') → env(OPENAI_API_KEY) |
| OpenAI (Whisper) | Same as above |
| HeyGen | user.own_heygen_api_key (only — no fallback) |
| WaveSpeed | Setting('wavespeed_api_key') (only) |
| Pexels | Setting('pexels_api_key') — passed to client! |
| json2video | Hardcoded in source (both backend and frontend) |

There is **no single source of truth** for "where does this key come from" beyond `OpenAiController::resolveApiKey`'s 3-tier fallback.
