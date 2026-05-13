# Backend Audit — Laravel 12 API

Generated 2026-05-06. Source: comprehensive scan of `/home/coder/workspace/AlMotion/freecut-backend/`.

A Laravel 12 API serving the AlMotion (FreeCut-derived) video-editing SPA. SQLite-backed, Sanctum auth, with proxy controllers wrapping OpenAI, HeyGen, WaveSpeed, and a custom json2video transcribe service.

---

## 1. Routes Inventory

All routes in `routes/api.php`. Laravel auto-prefixes `/api`. Two custom middleware aliases registered in `bootstrap/app.php:16-18`: `admin` → `AdminMiddleware`, `plan.limit` → `CheckPlanLimits`.

### Auth (`routes/api.php:21-31`)
| Method | Path | Action | Middleware | Purpose |
|---|---|---|---|---|
| POST | `/auth/register` | `AuthController@register` | public | Sign up; returns `{user, token}` 201 |
| POST | `/auth/login` | `AuthController@login` | public | Returns `{user, token}` |
| POST | `/auth/logout` | `AuthController@logout` | `auth:sanctum` | Revoke current token |
| GET | `/auth/me` | `AuthController@me` | `auth:sanctum` | Current user with `plan` eager-loaded |

### Projects (`routes/api.php:34-35`)
| Method | Path | Middleware | Purpose |
|---|---|---|---|
| GET | `/projects` | auth | List user projects with `media_files_count` |
| POST | `/projects` | auth + `plan.limit:projects` | Create |
| GET | `/projects/{project}` | auth | Project + `mediaFiles` + `chatMessages` |
| PUT/PATCH | `/projects/{project}` | auth | Update including `timeline_data`/`settings` |
| DELETE | `/projects/{project}` | auth | Delete |

### Media (`routes/api.php:38-46`)
| Method | Path | Middleware | Purpose |
|---|---|---|---|
| GET | `/projects/{project}/media` | auth | List |
| POST | `/projects/{project}/media` | auth + `plan.limit:storage` | Upload (max 500 MB) |
| GET | `/media/{medium}` | auth | Get one |
| PUT | `/media/{medium}` | auth | Update metadata |
| DELETE | `/media/{medium}` | auth | Delete + decrement `storage_used` |
| GET | `/projects/{project}/transcripts/{mediaId}` | auth | Get transcript (mediaId = frontend UUID) |
| PUT | `/projects/{project}/transcripts/{mediaId}` | auth | Save transcript |

### Chat — legacy (`routes/api.php:49-51`)
GET/POST `/projects/{project}/chat`, DELETE `/chat/{chat}`. Pre-sessions chat. Still wired but superseded by Chat Sessions; **no UI writes to it**.

### Chat sessions (`routes/api.php:54-59`)
GET/POST `/projects/{project}/sessions`, GET/POST `/projects/{project}/sessions/{session}/messages`, PUT/DELETE `/projects/{project}/sessions/{session}`. Auto-titles session from first user message (60 chars, `ChatSessionController.php:75`).

### OpenAI proxy (`routes/api.php:62-64`)
| Method | Path | Middleware | Purpose |
|---|---|---|---|
| POST | `/openai/chat` | auth + `plan.limit:tokens` | Proxy chat completions; logs `TokenUsage`, increments user counter |
| POST | `/openai/transcribe` | auth + `plan.limit:tokens` | Whisper-1 (max 25 MB) |
| GET | `/user/ai-config` | auth | Bundle of allowed_models, default_model, pexels_api_key, ai_system_prompt, ai_rules, ai_tool_descriptions |

### HeyGen (`routes/api.php:25, 67-73`)
- `GET /heygen/proxy-image` — **public**, server-side image proxy (`?url=`). Loose substring check for `heygen` or `files2.heygen` (SSRF concern).
- All others auth-gated.
- `config`, `listAvatars` (v2), `listAvatarLooks` (v3), `listVoices` (v2), `createAvatar` (v2/photo_avatar — gated by `can_create_avatars`), `createVideo` (v2/video/generate), `getVideo` (v1/video_status.get; on `completed` increments `heygen_credits_used_this_month` by `ceil(duration)`).
- **`resolveApiKey` always requires user's own key** — never falls back to admin (`HeyGenController.php:230-236`).

### WaveSpeed (`routes/api.php:76-78`)
Single hardcoded model `bytedance/seedance-v1-pro-fast` text-to-video. Admin-managed `wavespeed_api_key` only.
- `POST /wavespeed/generate` — gated by `can_generate_broll`, validates prompt+resolution(480p/720p/1080p)+duration(2-12s)+aspect_ratio+seed.
- `GET /wavespeed/status/{requestId}` — polls `predictions/{id}/result`.
- `GET /wavespeed/config` — flags only.
- **No usage tracking** for B-roll (binary capability).

### Transcribe — json2video proxy (`routes/api.php:81-83`)
**Hard-coded against `http://168.231.108.200:2993` with hardcoded API key `j2v_mbnW39bhYRc7UXkevMSOctKnd1acIQXY`** in `OpenAiController.php:84,98,108,113`.
- `POST /transcribe/start` (max 200 MB)
- `GET /transcribe/status/{jobId}`
- `POST /transcribe/srt` — fetches SRT body from any URL (**SSRF: no allow-listing**)

### User settings (`routes/api.php:86-87`)
GET/PUT `/user/settings` — own OpenAI + HeyGen keys (masked on read).

### Agents — user (`routes/api.php:90`)
`apiResource('agents')`. Lists global + own; create/update/delete only own. Plan-gated (`can_create_agents`, `max_agents`).

### Admin (`routes/api.php:93-103`, prefix `/admin`, `auth:sanctum + admin`)
- `GET /admin/dashboard` — totals + counts + recent_users + blocked_users
- `apiResource('plans')` — full CRUD; auto-slug; one-default invariant
- `apiResource('users')` + `assign-plan` + `toggle-block` (refuses on admin)
- GET/PUT `/admin/settings` — masked API keys, `*_set` booleans
- `apiResource('agents')` — global agents (forces `is_global=true, user_id=null`)

---

## 2. Eloquent Models (`app/Models/`)

### `User` (`User.php`)
- Extends `Authenticatable`, uses `HasApiTokens` (Sanctum)
- Fillable: `name, email, password, is_admin, plan_id, storage_used, tokens_used_this_month, tokens_reset_at, is_blocked, own_openai_api_key, own_heygen_api_key, can_use_own_api_key`
- Hidden: `password, remember_token, own_openai_api_key, own_heygen_api_key`
- Casts: `password → hashed`, bools `is_admin/is_blocked/can_use_own_api_key`
- Relations: `plan()`, `projects()`, `mediaFiles()`, `chatMessages()`, `tokenUsages()`, `userAvatars()`
- **`heygen_credits_used_this_month` is NOT in fillable** but mutated via `increment()` in `HeyGenController.php:176`

### `Plan` (`Plan.php`)
Full plan-tier config. Fillable includes capability flags (`can_use_own_api_key, can_generate_broll, can_create_agents, can_use_heygen, can_create_avatars, can_use_own_heygen_key`) and limits (`max_projects, max_storage_mb, max_ai_tokens_monthly, max_agents, max_heygen_credits_monthly`). `features` and `allowed_models` cast to `array`.

### `Project`, `MediaFile`, `ChatMessage`, `ChatSession`, `Agent`, `Setting`, `TokenUsage`, `Transcript`, `UserAvatar`
- `Setting` is generic key/value with static `get($key, $default)`/`set($key, $value)` helpers — used as ad-hoc admin config.
- `Transcript.media_id` is a STRING (frontend IndexedDB UUID), distinct from `media_files.id`. Unique on `(project_id, media_id)`.
- `ChatMessage` has nullable `session_id` FK — used by both legacy and new sessions API.

No accessors/mutators or query scopes are defined on any model.

---

## 3. Migrations Chronologically (key business semantics)

1. `0001_01_01_000000` — base users, sessions, password_reset_tokens
2. `0001_01_01_000001-2` — cache, jobs (DB driver)
3. `2026_04_08_073204` — Sanctum personal_access_tokens
4. `2026_04_08_081908` — `token_usages` (per-call AI usage log)
5. `2026_04_08_093959` — adds `is_admin`, initial flat plan model (`plan` string, `monthly_token_limit`)
6. `2026_04_08_100000` — introduces tiered `plans` table
7. `2026_04_08_100001` — drops legacy plan strings; adds `plan_id` FK, `storage_used`, `is_blocked`
8. `2026_04_08_100002` — `projects` (timeline_data, settings JSON, defaults 1920×1080@30fps)
9. `2026_04_08_100003` — `media_files` (path, hash, size, duration)
10. `2026_04_08_100004` — `chat_messages` (legacy flat)
11. `2026_04_08_120000-1` — `settings` k/v table, `can_use_own_api_key` (plan + user)
12. `2026_04_08_130000` — `plans.allowed_models` JSON
13. `2026_04_11_055432` — `media_files.transcript_data` JSON (now dead column)
14. `2026_04_11_061520` — `transcripts` table (new path)
15. `2026_04_22_100000` — `plans.can_generate_broll`
16. `2026_04_24_100000-1` — `agents` table; `plans.can_create_agents`, `max_agents`
17. `2026_04_25_100000` — `chat_sessions`; `chat_messages.session_id`
18. `2026_04_29_100000` — HeyGen plan flags + user fields + `user_avatars`

---

## 4. Middleware

### `AdminMiddleware`
Single check: `if (!$request->user() || !$request->user()->is_admin) → 403`. Does NOT check `is_blocked`.

### `CheckPlanLimits` — `plan.limit:{type}`
Where `type ∈ {projects, storage, tokens}`:
- 401 if no user
- **403 if `is_blocked`** (only enforcement of block; routes without this middleware won't refuse blocked user)
- Loads plan with defaults: `max_projects=3, max_storage_mb=500, max_ai_tokens_monthly=50000`
- **`projects`**: 429 if `count >= max_projects`
- **`storage`**: 429 if `storage_used >= max_storage_mb*1024*1024` (bytes)
- **`tokens`**: calls `resetTokensIfNeeded` (rolling 30 days, NOT calendar-monthly), then 429

**Other limits are enforced inside controllers** (HeyGen credits/access, B-roll plan, agent quotas, OpenAI model allowance).

---

## 5. Services / Business Logic

**No `app/Services/` or `app/Jobs/` directory.** All logic lives in controllers. No queue jobs, no events/listeners, no console commands beyond Laravel defaults.

### `OpenAiController` (271 lines)
- `proxy()` — Resolves key (own → admin Setting → env), validates model in allowed list, forwards raw body to `https://api.openai.com/v1/chat/completions`. Records `TokenUsage`. **No streaming.**
- `transcribeProxy()` — Forwards to hardcoded j2v IP+key. **Bug: language form-field is built but discarded** (lines 87-99).
- `transcribeStatus($jobId)` — Same hardcoded host+key.
- `transcribeSrt(Request)` — Fetches arbitrary URL → `text/plain`. **SSRF: no allow-listing**.
- `transcribe()` — Whisper-1; tokens estimated as `duration*100`.
- `aiConfig()` — Returns Pexels API key verbatim to client (`:198`).
- `getAllowedModels()` — Two paths: own-key (`Setting::get('user_key_allowed_models')` → `ALL_MODELS`) vs platform-key (`plan.allowed_models` → `DEFAULT_PLAN_MODELS=['gpt-4o-mini']`). `ALL_MODELS = [gpt-4.1, gpt-4.1-mini, gpt-4o, gpt-4o-mini, o4-mini, o3-mini]`.
- `resolveApiKey()` — own → admin Setting → `env('OPENAI_API_KEY')`.
- `canUserUseOwnKey()` — User-level override → global `Setting::get('allow_user_api_keys', 'true')` → plan flag.

### `HeyGenController` (257 lines)
HeyGen REST passthrough mixing v1/v2/v3. Always requires user's own key (no admin fallback).

### `WaveSpeedController` (92 lines)
Single seedance-v1-pro-fast endpoint. Admin-only key.

### Other
- `ProjectController` — straight CRUD; `update()` accepts `settings`; `show()` eager-loads `mediaFiles` + `chatMessages` (heavy on long chats).
- `MediaFileController` — uploads to `public` disk under `media/{user_id}/{project_id}/`; SHA-256 dedup; 2 dead unrouted methods `getTranscript`/`saveTranscript`.
- `TranscriptController` — keyed on `(project_id, media_id)`.
- `ChatMessageController`, `ChatSessionController` — straight CRUD.
- `UserSettingsController`, `AgentController` + `Admin\AgentController` — split owner/global responsibilities.

---

## 6. Config & Environment

### Custom config files
None — all in `config/` are stock Laravel. No `services.php` entries for OpenAI/HeyGen/WaveSpeed.

### Key configs
- `config/cors.php`: `paths: ['api/*', 'sanctum/csrf-cookie']`, `allowed_methods/origins/headers: ['*']`, `supports_credentials: false`.
- `config/sanctum.php`: `expiration: null` — **tokens never expire**. Stateful API supported via `bootstrap/app.php:20`.
- `config/auth.php`: default web/session guard, `App\Models\User`.

### App-specific env vars
- `OPENAI_API_KEY` — `OpenAiController.php:247`. **Sensitive. Currently committed in `.env:7`.**
- `PEXELS_API_KEY` — `OpenAiController.php:186`. Sensitive.

---

## 7. Storage Paths and Uploads

- `local`: `storage/app/private` (private)
- `public`: `storage/app/public`, served at `{APP_URL}/storage` (requires `storage:link`)
- Default disk per `.env:39`: `local`

### Upload locations
- Media: `MediaFileController.php:34` → `media/{userId}/{projectId}/<random>.ext` on public disk. Path stored in DB.
- HeyGen photo: forwarded to HeyGen, **not persisted locally**.
- json2video: in-memory forward, **not persisted locally**.

### Serving
Files served via `{APP_URL}/storage/...` (the symlink), **not through `/api/*`**. **No token check on file URLs** — anyone with URL can fetch.

### Storage tracking
`users.storage_used` (bytes) only tracked through upload/delete paths. If files removed manually, no reconciliation.

---

## 8. Auth Model

- **Sanctum personal access tokens** (`HasApiTokens`)
- **Token never expires** (`config/sanctum.php:50`)
- **Token has no abilities** — `createToken('auth-token')` passes no abilities → `*` (all)
- Login: `POST /api/auth/login` → validate → `Hash::check` → `createToken()` → `200 {user, token}`. Registration returns `201`.
- Logout deletes only **current** access token (per-device).
- Stateful API enabled via `$middleware->statefulApi()` (`bootstrap/app.php:20`).

---

## 9. Notable / Gotchas

### Security-impacting
1. **Real OpenAI API key committed in `.env:7`** (`sk-proj-Y0rNDJzZ9zXh…`). **Rotate immediately.**
2. **`APP_DEBUG=true`** in `.env:4` — leaks stack traces.
3. **Hardcoded j2v API key** `j2v_mbnW39bhYRc7UXkevMSOctKnd1acIQXY` (`OpenAiController.php:84,108`) and frontend `json2video-service.ts:128`.
4. **Hardcoded internal IP** `http://168.231.108.200:2993` (plaintext HTTP).
5. **`/api/transcribe/srt` SSRF** — fetches any URL.
6. **`/api/heygen/proxy-image`** public + loose substring check (`heygen` or `files2.heygen`).
7. **CORS wide open** (`allowed_origins: ['*']`).
8. **Pexels key returned to client** in `/user/ai-config`.
9. **Sanctum tokens never expire**.
10. **No rate limiting** beyond plan-based monthly counters.
11. **Seeded admin password is weak**: `murad.cafarzada212@gmail.com` / `admin123456` (`DatabaseSeeder.php:43-48`).

### Functional bugs / dead code
12. `transcribeProxy` ignores `language` form-field (rebuild bug).
13. Two transcript storage backends coexist (`media_files.transcript_data` is dead column).
14. `MediaFileController::getTranscript`/`saveTranscript` (`:99-128`) are **unrouted**.
15. **Admin can promote any user to admin** via `users.update`.
16. `User.heygen_credits_used_this_month` not in `$fillable` (works via `increment()`).
17. Token reset is rolling 30 days, not calendar-monthly. **No reset for `heygen_credits_used_this_month` ever.**
18. `Project::show` eager-loads `chatMessages` — heavy for long chats.
19. Legacy `chat_messages` routes still exist alongside sessions.
20. **New users not auto-assigned default plan** (`AuthController::register` doesn't set `plan_id`).
21. `Admin\UserController::index` `orWhere` not grouped — search will leak past WHERE constraints.

### Operational
22. **DB is SQLite** — fine for dev, plan migration to MySQL/Postgres before production.
23. **No queue workers**. All third-party API calls synchronous in PHP-FPM (timeouts up to 300s — long uploads tie up workers).
24. **No tests written** — only Laravel scaffolding.
25. **No webhooks** for HeyGen/WaveSpeed — frontend must poll. Credits only billed when frontend polls; if user closes tab, free.
26. **`storage:link` required** on every fresh checkout.
27. **No security headers** (CSP etc.).

### Quick wins
- Rotate OpenAI key in `.env:7` and j2v key in `OpenAiController.php`/frontend.
- `APP_DEBUG=false` and fresh `APP_KEY` in non-dev.
- Add `throttle:60,1` to `/auth/login` and proxy routes.
- Tighten `cors.php` and HeyGen proxy domain check.
- Remove legacy chat routes once verified.
- Consider MySQL/Postgres migration.
