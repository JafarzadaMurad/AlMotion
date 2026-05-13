# Frontend ↔ Backend Integration Map

Generated 2026-05-06. Documents every integration point between React SPA (`freecut/`) and Laravel API (`freecut-backend/`).

---

## 1. API Client Architecture

**File:** `src/infrastructure/api/api-client.ts`

- **Base URL** — hardcoded line 1: `const API_BASE_URL = 'http://localhost:8000/api'`. **No `import.meta.env` indirection.** Bake-time constant.
- **Token attachment** — `ApiClient.getToken()` reads `localStorage['auth-storage']`, parses, returns `parsed.state?.token`. Piggybacks on Zustand `persist` (key set in `auth-store.ts:103`). Adds `Authorization: Bearer ${token}` to every request.
- **Error handling** in `request()`:
  - 401: clear `auth-storage`, hard-redirect `window.location.href = '/login'`, throw `'Unauthorized'`.
  - Non-2xx: try JSON parse → `{ message, errors? }`, fallback `{ message: 'HTTP <status>' }`. **Throws the parsed object, not Error instance** — consumers do `(err as { message?: string })?.message`.
  - 204: returns `{}` cast to `T`.
- **Methods**: `get`, `post`, `put`, `delete`, `upload` (multipart).
- `upload()` does NOT apply 401 redirect logic — only throws.
- **No callsite for `ApiClient.upload`** today — media uploads use IndexedDB/OPFS instead.

**Token storage:** `localStorage['auth-storage']` only. Shape: `{ state: { user, token }, version }`. Same key read by `OpenAiService` (`openai-service.ts:10`) — soft duplication.

**Login flow updating state** — `useAuthStore.login()` (`auth-store.ts:36-54`):
1. `set({ isLoading: true, error: null })`
2. `await ApiClient.post<AuthResponse>('/auth/login', credentials)`
3. `set({ user, token, isLoading: false })`
4. Zustand `persist` writes `{ user, token }` to localStorage automatically.

---

## 2. Auth Flow (Frontend)

- **Login UI**: `src/routes/login.tsx` — TanStack file route at `/login`. Calls `useAuthStore().login` → navigate `/projects` on success.
- **Register UI**: `src/routes/register.tsx`.
- **Marketing landing**: `src/routes/index.tsx` + `src/components/layout/marketing-header.tsx`.

### Route gating (3 layers)

1. **Root-level redirect** (`src/routes/__root.tsx:13-33`): on every render, an effect inspects `pathname` against `publicRoutes = ['/', '/login', '/register']` and calls `router.navigate({ to: '/login' })` whenever `!token` and path isn't public. A second effect calls `fetchMe()` after token rehydrates.
2. **Per-route `beforeLoad` hooks** for admin/protected pages — `routes/settings.tsx`, `routes/admin/*.tsx` (admin pages also check `user?.is_admin`), `routes/agents/*.tsx`.
3. **Sidebar visibility** (`__root.tsx:11`): `NO_SIDEBAR_ROUTES = ['/login', '/register', '/', '/editor']` — sidebar wraps `<Outlet />` only when `token` is present and path doesn't match.

**Session/profile store**: `src/features/auth/stores/auth-store.ts`. State: `user, token, isLoading, error`. Actions: `login, register, logout, fetchMe, clearError`. Persisted partial: `{ user, token }` only.

**Logout**: `auth-store.ts:76-83`. Best-effort `await ApiClient.post('/auth/logout')` (errors swallowed) → `set({ user: null, token: null })`. Wired from `marketing-header.tsx`, `admin-layout.tsx`, `app-sidebar.tsx`.

---

## 3. Per-Feature Backend Usage

### Projects (CRUD)
Wrapper `src/infrastructure/api/project-api.ts` with `BackendProject` ↔ `Project` mappers.

| Endpoint | Function | Caller |
|---|---|---|
| `GET /projects` | `fetchProjects` (`:85`) | `project-store.ts:132` (`loadProjects`) |
| `GET /projects/{id}` | `fetchProject` (`:91`) | `project-store.ts:148`, `routes/editor/$projectId.tsx:13`, `timeline-store-facade.ts:564, 768` |
| `POST /projects` | `createProjectApi` (`:108`) | `project-store.ts:171, 381` (create + duplicate) |
| `PUT /projects/{id}` | `updateProjectApi` (`:122`) | `project-store.ts:239` (manual save), `timeline-store-facade.ts:725, 807` (autosave), `commands/snapshot.ts:68` (undo restore) |
| `DELETE /projects/{id}` | `deleteProjectApi` (`:127`) | `project-store.ts:344` |

### Media library + uploads
**No frontend code uploads media files to backend.** Despite `POST /projects/{p}/media` existing, zero callsites for `/projects/.*/media`. Media flows entirely through IndexedDB (`src/infrastructure/storage/indexeddb/media.ts`) + OPFS (`src/features/media-library/services/opfs-service.ts`).

Only media → backend traffic is **transcripts**:
- `GET /projects/{p}/transcripts/{mediaId}` — `media-transcription-service.ts:59-61` (fallback when local IndexedDB has no transcript).
- `PUT /projects/{p}/transcripts/{mediaId}` — `media-transcription-service.ts:181` (after local transcribe).

### Transcription — TWO PATHS, both in use

#### json2video (current default)
`src/features/media-library/services/json2video-service.ts`. `baseUrl = '/api/v1'` routed through Vite proxy (`vite.config.ts`) which rewrites `/api/v1` → `/api` and forwards to `http://127.0.0.1:8000`.

- `POST /api/v1/transcribe` → After Vite rewrite hits `/api/transcribe`, **but Laravel route is `/api/transcribe/start`** (`api.php:81`). **Path mismatch!** Frontend may currently be broken until either Laravel route renamed or proxy points at original j2v host (`168.231.108.200:2993`).
- `GET /api/v1/transcribe/{jobId}` (line 42)
- SRT URL has `http://168.231.108.200:2993` stripped (line 79-80) → expected to be served via same Vite proxy.
- Hardcoded API key line 128: `j2v_mbnW39bhYRc7UXkevMSOctKnd1acIQXY`.

#### OpenAI Whisper
- `POST /api/openai/transcribe` (Laravel `OpenAiController@transcribe`) — **NO frontend callsite** via ApiClient.
- `openai-service.ts:96` posts directly to `https://api.openai.com/v1/audio/transcriptions` using user's own key — bypasses backend.

### Chat / agents (AI assistant)
**Chat panel UI:** `src/features/editor/components/ai-chat-panel.tsx` (mounted in editor).
**Store:** `src/features/editor/stores/ai-chat-store.ts` (Zustand + persist).
**Wrapper:** `src/infrastructure/api/chat-api.ts`.

Sessions (used by current UI):
- GET `/projects/{p}/sessions` — `chat-api.ts:70` → `ai-chat-store.ts:183`
- POST `/projects/{p}/sessions` — `chat-api.ts:74`
- GET `/projects/{p}/sessions/{id}/messages?page=&per_page=` — `chat-api.ts:83`
- POST `/projects/{p}/sessions/{id}/messages` — `chat-api.ts:98`
- PUT `/projects/{p}/sessions/{id}` — `chat-api.ts:110`
- DELETE `/projects/{p}/sessions/{id}` — `chat-api.ts:106`

Legacy (callable but unused by current UI):
- GET/POST `/projects/{p}/chat`, DELETE `/chat/{id}`.

**OpenAI proxy:** `src/infrastructure/ai/openai-service.ts:23, 29, 60` posts to `http://localhost:8000/api/openai/chat` directly (NOT via `ApiClient`). Hardcoded URL. Headers attach `Bearer ${token}` from `auth-storage`.

**Chat panel boot:**
- GET `/user/ai-config` — `ai-chat-panel.tsx:84` (`available_models, default_model, pexels_api_key, ai_system_prompt, ai_rules, ai_tool_descriptions`).
- GET `/agents` — `ai-chat-panel.tsx:102`.

**Agent management UI** (`src/routes/agents/*`):
- `index.tsx:31` — GET `/agents`; `:41` — DELETE `/agents/{id}`
- `new.tsx:31` — POST `/agents`
- `$agentId.tsx:40` — GET, `:56` — PUT

### HeyGen avatars
All called via `ApiClient` from `src/infrastructure/ai/ai-tool-executor.ts`:
- GET `/heygen/avatars` (line 839) — `list_heygen_avatars` tool
- GET `/heygen/voices` (line 876) — `list_heygen_voices`
- POST `/heygen/videos` (line 966) — `generate_avatar_video`
- GET `/heygen/videos/{videoId}` (line 975) — status polling
- GET `/heygen/proxy-image?url=...` (lines 836, 985, 997) — **hardcoded `http://localhost:8000/api/heygen/proxy-image` directly via raw `fetch`**, bypasses ApiClient

Backend exposed but unused on FE: `POST /heygen/avatars`, `GET /heygen/avatar-looks`, `GET /heygen/config`.

### WaveSpeed B-roll
Driven from `ai-tool-executor.ts`:
- POST `/wavespeed/generate` (line 710) — submits generation
- GET `/wavespeed/status/{requestId}` (line 733) — polled every 3s, up to 6 min
- After completion (line 748), output URL fetched directly (WaveSpeed CDN, NOT proxied), then `mediaLibraryService.importMediaBlob` → OPFS/IndexedDB.

`GET /wavespeed/config` — exposed but not consumed.

### User settings
**UI:** `src/routes/settings.tsx`.
- GET `/user/settings` (line 31)
- PUT `/user/settings` (lines 92, 97, 118, 123) — connect/disconnect own keys

### Admin
All in `src/routes/admin/*`, gated on `user.is_admin`:
- `dashboard.tsx:44` — GET `/admin/dashboard`
- `plans.tsx:77,119,121,132` — GET/PUT/POST/DELETE `/admin/plans[/{id}]`
- `users.tsx:37,46,50,56,65` — GET users, GET plans, toggle-block, assign-plan, DELETE
- `settings.tsx:57,79,82` — GET/PUT `/admin/settings`
- `ai-config.tsx:59,72` — GET/PUT `/admin/settings` (writes `ai_system_prompt`, `ai_rules`, `ai_tool_descriptions`)
- `agents.tsx:87,123,125,136` — GET/PUT/POST/DELETE `/admin/agents[/{id}]`

### Purely client-side features (NO backend traffic)
Verified by grepping `ApiClient`, `fetch(`, `/api/`:
- `src/features/timeline/` — pure local Zustand + IndexedDB (only indirect through `updateProjectApi(timeline_data)`)
- `src/features/preview/` — DOM video / WebGPU rendering only
- `src/features/effects/` — GPU shaders
- `src/features/export/` — WebCodecs in Web Worker, MP4 to local file/OPFS
- `src/features/keyframes/` — animation, no I/O
- `src/features/composition-runtime/` — frame composition logic
- `src/features/player/` — playback Clock/scheduler
- `src/features/project-bundle/` — ZIP export/import (File System Access API, not network)
- `src/features/settings/` — local prefs in localStorage
- `src/features/admin/components/` — pure layout (network in routes)
- `src/features/auth/` — only `auth-store.ts` (uses ApiClient)
- `src/features/layout/` — pure UI sidebar

---

## 4. Storage Strategy Split

### Browser-side (per-project, per-user)
- **IndexedDB** via `idb` — `src/infrastructure/storage/indexeddb/`. Stores: `media`, `content` (content-addressed dedup), `project-media`, `thumbnails`, `transcripts`, `waveforms`, `gif-frames`, `decoded-preview-audio`, `project-local-data`, `projects` (legacy local cache). Schema in `schema.ts`.
- **OPFS** (Origin Private File System) via worker — `src/features/media-library/services/opfs-service.ts` + `workers/opfs-worker.ts`. Holds actual media bytes and waveform multi-resolution caches.
- **localStorage** — `auth-storage` (Zustand persist) + few small Zustand stores (settings, debug flags).
- **Cache API** — Kitten TTS ONNX models from HuggingFace (`kitten-tts-service.ts:10`).

### Server-side (Laravel)
- Project metadata + `timeline_data` JSON (whole timeline serialized on every save)
- Chat sessions and messages
- Transcripts (mirror of local IndexedDB)
- User profile, plans, billing counters, own API keys, agents, admin AI config

### Project state — backend is source of truth
Local IndexedDB keeps `project-local-data` for things server doesn't store: `rootFolderHandle` (File System Access handle for re-linking), `rootFolderName`, `thumbnailId`, `schemaVersion`. `mergeWithLocalData()` in `project-store.ts:75-94`. Timeline state lives in Zustand at runtime; saves pushed via `updateProjectApi` (autosave at `timeline-store-facade.ts:725`). Re-load fetches via `fetchProject`.

### Media files — 100% client-side
User picks files → `mediaLibraryService.importMediaBlob` writes bytes to OPFS, dedup-refs in `content` table, creates `media` row + project association. **Reopening project on another device requires user to re-link via File System Access API picker** (`setProjectRootFolder` in `project-store.ts:412`). Backend `MediaFileController` not exercised.

### Timeline — synced
Lives in Zustand at runtime, serialized to `ProjectTimeline` (tracks, items, transitions, keyframes, markers, sub-comps), pushed back as `timeline_data` on `PUT /projects/{id}`. Snapshot/undo (zundo) is client-side; only persisted post-command state hits backend.

---

## 5. Environment / Proxy / CORS

### Vite config (`vite.config.ts:14-39`)
```
server.port = 5173 (strictPort, currently overridden to 5273 for local dev)
allowedHosts: .trycloudflare.com, .cloudflareaccess.com, localhost
COEP: require-corp; COOP: same-origin (for SharedArrayBuffer / WebCodecs)
proxy:
  /renders   → http://127.0.0.1:8000 (no rewrite, no consumer found in src/)
  /api/v1    → http://127.0.0.1:8000, rewrite /^\/api\/v1/ → '/api'
             timeout: 300000ms (5 min, for big transcription uploads)
             keep-alive header forced
```

`/api/v1` proxy consumed only by `Json2VideoService` (`baseUrl = '/api/v1'`). Everything else hardcodes `http://localhost:8000/api`.

### Frontend env vars
**Only `VITE_SHOW_DEBUG_PANEL` is documented** in `.env.example` and used at `toolbar.tsx:128`. **No** `VITE_API_BASE_URL` or similar — adding one would also require declaring in `vite-env.d.ts`.

### Backend CORS
`paths: ['api/*', 'sanctum/csrf-cookie']`, `allowed_methods/origins/headers: ['*']`, `supports_credentials: false`. Permissive — works with bearer-token Sanctum approach.

---

## 6. Third-party API Integrations on the Frontend (NOT via Backend)

- **Pexels** — `pexels-service.ts:27` hits `https://api.pexels.com/videos/search` directly. Key fetched from `/user/ai-config` and seeded at `ai-chat-panel.tsx:90`. Used by `BrollService` (`broll-service.ts:143, 224`).
- **Google Fonts** — preconnect + stylesheet in `index.html:7,9` (IBM Plex Sans + Mono); dynamic family loads at `font-loader.ts:91`.
- **HuggingFace (Kitten TTS models)** — `kitten-tts-service.ts:98-117` downloads ONNX from `huggingface.co/KittenML/...`. Cached in Cache API.
- **Pexels video CDN** — `*.pexelsvideo.com` direct fetch in `broll-service.ts:159, 237`.
- **WaveSpeed CDN** — output URL fetched directly at `ai-tool-executor.ts:748`.
- **OpenAI direct** — `openai-service.ts:96` (only when called with user-provided key).
- **External json2video** — historically `http://168.231.108.200:2993` (still referenced in SRT URL replace).

---

## 7. Files Hardcoding `localhost:8000` or Remote URLs

| File:line | Hardcoded value | Notes |
|---|---|---|
| `src/infrastructure/api/api-client.ts:1` | `http://localhost:8000/api` | Base URL — every `ApiClient.*` call. **Highest impact.** |
| `src/infrastructure/ai/openai-service.ts:23` | `http://localhost:8000/api/openai/chat` | Bypasses ApiClient (raw fetch). Update in lockstep. |
| `src/infrastructure/ai/ai-tool-executor.ts:836` | `http://localhost:8000/api/heygen/proxy-image?url=...` | Avatar/look thumbnail URLs |
| `src/infrastructure/ai/ai-tool-executor.ts:985` | same | Generated HeyGen video download (COEP/CORP) |
| `src/infrastructure/ai/ai-tool-executor.ts:997` | same | SRT caption file from HeyGen render |
| `src/features/media-library/services/json2video-service.ts:3` | `'/api/v1'` | Relative — Vite proxy. Production needs equivalent. |
| `src/features/media-library/services/json2video-service.ts:79` | `http://168.231.108.200:2993` | Stripped from SRT URL |
| `src/features/media-library/services/json2video-service.ts:128` | `j2v_mbnW39bhYRc7UXkevMSOctKnd1acIQXY` | Hardcoded API key in bundle |
| `vite.config.ts:24, 28` | `http://127.0.0.1:8000` | Proxy targets |
| `index.html:7,9`, `font-loader.ts:91` | `fonts.googleapis.com` | Public CDN |
| `kitten-tts-service.ts:98-117` | `huggingface.co/KittenML/...` | Public model CDN |

**Recommendation:** introduce `VITE_API_BASE_URL` (declared in `vite-env.d.ts` and `.env.example`) and have `api-client.ts:1`, `openai-service.ts:23`, three `ai-tool-executor.ts` `proxy-image` lines read from it.

---

## Summary: All Backend Endpoints Actually Consumed

| Endpoint | Method(s) | Frontend caller |
|---|---|---|
| `/auth/register` | POST | `auth-store.ts:60` |
| `/auth/login` | POST | `auth-store.ts:40` |
| `/auth/logout` | POST | `auth-store.ts:78` |
| `/auth/me` | GET | `auth-store.ts:89` |
| `/projects` | GET, POST | `project-api.ts:85, 108` |
| `/projects/{id}` | GET, PUT, DELETE | `project-api.ts:91, 122, 127` |
| `/projects/{id}/transcripts/{mediaId}` | GET, PUT | `media-transcription-service.ts:60, 181` |
| `/projects/{id}/sessions` | GET, POST | `chat-api.ts:70, 74` |
| `/projects/{id}/sessions/{sid}` | PUT, DELETE | `chat-api.ts:106, 110` |
| `/projects/{id}/sessions/{sid}/messages` | GET, POST | `chat-api.ts:84, 99` |
| `/openai/chat` | POST | `openai-service.ts:23` |
| `/user/ai-config` | GET | `ai-chat-panel.tsx:84` |
| `/user/settings` | GET, PUT | `routes/settings.tsx:31, 92, 97, 118, 123` |
| `/agents` | GET, POST | `ai-chat-panel.tsx:102`, `routes/agents/*` |
| `/agents/{id}` | GET, PUT, DELETE | `routes/agents/$agentId.tsx`, `index.tsx` |
| `/heygen/avatars` | GET | `ai-tool-executor.ts:839` |
| `/heygen/voices` | GET | `ai-tool-executor.ts:876` |
| `/heygen/videos` | POST | `ai-tool-executor.ts:966` |
| `/heygen/videos/{id}` | GET | `ai-tool-executor.ts:975` |
| `/heygen/proxy-image?url=` | GET | `ai-tool-executor.ts:836, 985, 997` |
| `/wavespeed/generate` | POST | `ai-tool-executor.ts:710` |
| `/wavespeed/status/{rid}` | GET | `ai-tool-executor.ts:733` |
| `/admin/dashboard` | GET | `routes/admin/dashboard.tsx:44` |
| `/admin/plans[/{id}]` | GET, POST, PUT, DELETE | `routes/admin/plans.tsx`, `users.tsx:46` |
| `/admin/users[/{id}]` | GET, DELETE | `routes/admin/users.tsx:37, 65` |
| `/admin/users/{id}/assign-plan` | POST | `routes/admin/users.tsx:56` |
| `/admin/users/{id}/toggle-block` | POST | `routes/admin/users.tsx:50` |
| `/admin/settings` | GET, PUT | `routes/admin/settings.tsx`, `ai-config.tsx` |
| `/admin/agents[/{id}]` | GET, POST, PUT, DELETE | `routes/admin/agents.tsx` |

**Backend declared but UNUSED on frontend:** `POST /heygen/avatars`, `GET /heygen/avatar-looks`, `GET /heygen/config`, `GET /wavespeed/config`, `POST /openai/transcribe`, `POST /transcribe/start`, `GET /transcribe/status/{jobId}`, `POST /transcribe/srt`, entire `MediaFileController` set.
