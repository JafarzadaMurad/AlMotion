# AlMotion AI sidecar

OpenAI-compatible façade over CLI-harness AI backends. Today: Claude Code
**subscription**. Planned in the same process: Gemini CLI, OpenAI Codex.

## Why it exists

A Claude subscription cannot be driven through `/v1/messages` — only through
the Claude Code harness. That harness is the Agent SDK, which is Node, and the
AlMotion backend is PHP.

Spawning the bare `claude` CLI is not enough either. What makes **tools** work
is the harness's in-process MCP bridge (`createSdkMcpServer`), and only the SDK
provides it. So the harness lives here, behind the same
`POST /v1/chat/completions` contract the Laravel backend already speaks to
OpenAI, Anthropic and Gemini. The editor's ~30 browser-side tools travel as
ordinary OpenAI tool definitions and come back as ordinary `tool_calls`.

## The one thing to understand before changing it

**The sidecar never executes a tool.** AlMotion's tools run in the browser —
they move clips, apply effects, open pickers. So the protocol is OpenAI's:
return the tool calls, let the client run them and come back with results.

The harness has no such notion; it calls a tool and waits. So the bridged tool
handlers exist only to make the tools *callable*, and the run is aborted the
moment the model emits `tool_use`. Whatever a handler returns is discarded. If
you "fix" the stub handlers to return real data, the model will reason on top
of results the client never produced.

## Prerequisites

- Node 20+
- **The `claude` CLI must be installed and on `PATH`.** The SDK spawns it; when
  it is missing the harness hangs rather than failing, which is why every run
  carries a deadline (`timeoutMs`, default 240s).
  ```
  npm install -g @anthropic-ai/claude-code
  ```
- A subscription token from `claude setup-token`.

## Running

```bash
cd ai-sidecar
npm install
SIDECAR_SECRET=some-shared-secret node src/server.js
```

| Env | Default | Purpose |
|---|---|---|
| `SIDECAR_PORT` | `8790` | listen port |
| `SIDECAR_HOST` | `127.0.0.1` | bind address — keep it loopback |
| `SIDECAR_SECRET` | *(unset)* | required `Authorization: Bearer`; unset means no auth (dev only) |
| `CLAUDE_SUB_TOKENS` | *(unset)* | JSON `[{id,label,token}]`, or one bare token |

Tokens normally arrive **per request** from the backend (`__tokens`), so
rotating one in the admin page takes effect immediately without a restart. The
env var is a fallback for running the sidecar standalone.

**This process holds subscription tokens and runs a harness. It must never be
reachable from outside the machine.** Bind loopback and set a secret.

## Endpoints

- `GET /health` — pool status. Never includes the tokens themselves.
- `POST /v1/chat/completions` — OpenAI request in, OpenAI response out.
  - `503` = every token benched, or the sidecar cannot serve. The backend reads
    this as "fall back to the API key".
  - `502` = a real failure worth an operator's attention.

## Token pool

A subscription's rate limit is sized for one person's day of work, and an
editor with several people in it will exceed that. Running out is designed for:
round-robin across tokens, a rate-limited token benched 15 minutes, a rejected
one benched an hour, and `503` when all are benched so the backend falls back.
Unknown errors never bench — a malformed request must not take the pool down.

## Backend wiring

`ClaudeSubscriptionProvider` (Laravel) posts here and is registered in
`AppServiceProvider`. It exposes `claude-sub-opus|sonnet|haiku` so choosing the
subscription is explicit rather than a silent reroute of `claude-*` traffic.
`OpenAiController` retries on the API-key Anthropic provider when it sees 503.

Admin settings: `claude_subscription_tokens`, `claude_subscription_url`,
`claude_subscription_secret`.

## Tests

```bash
npm test
```

29 tests over the translation layer and the pool — the two places where a
mistake is silent. The harness call itself is not covered: it needs a real
token and the CLI.

## Note

Claude Code subscriptions are sold for individual interactive use. This is
deployed for internal staff only, by the operator's decision.
