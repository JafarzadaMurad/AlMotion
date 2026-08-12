import http from 'node:http';
import { TokenPool } from './token-pool.js';
import { runTurn } from './claude-runner.js';
import { toOpenAiResponse } from './openai-bridge.js';

/**
 * OpenAI-compatible façade over CLI-harness AI backends.
 *
 * Laravel cannot host the Claude Agent SDK, and a bare CLI subprocess loses
 * the in-process MCP bridge that makes tools work at all. So the harness lives
 * here, behind the same `/v1/chat/completions` contract every other provider
 * in the backend already speaks — which means the editor's 30 tools and its
 * whole chat loop need no changes.
 *
 * Gemini CLI and Codex are meant to land in this same process behind the same
 * endpoint, keyed off the requested model.
 *
 * Trust model: binds to localhost and expects a shared secret. It holds
 * subscription tokens and runs a harness, so it must never be reachable from
 * outside the machine.
 */

const PORT = Number(process.env.SIDECAR_PORT ?? 8790);
const HOST = process.env.SIDECAR_HOST ?? '127.0.0.1';
const SHARED_SECRET = process.env.SIDECAR_SECRET ?? '';

const pool = new TokenPool(parseTokens(process.env.CLAUDE_SUB_TOKENS));

function parseTokens(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    // A single bare token is the common case; accept it rather than making
    // the operator hand-write JSON to try the thing out.
    return [{ id: 'default', label: 'default', token: String(raw).trim() }];
  }
}

function send(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(payload),
  });
  res.end(payload);
}

function readBody(req, limitBytes = 12 * 1024 * 1024) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      // Timelines with long transcripts produce big prompts; the cap is here
      // to stop a runaway request eating memory, not to be tight.
      if (size > limitBytes) {
        reject(new Error('Request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function authorized(req) {
  if (!SHARED_SECRET) return true; // unset means single-machine dev
  const header = req.headers.authorization ?? '';
  return header === `Bearer ${SHARED_SECRET}`;
}

async function handleChatCompletions(req, res) {
  let payload;
  try {
    payload = JSON.parse(await readBody(req));
  } catch (error) {
    send(res, 400, { error: { message: `Invalid request body: ${error.message}` } });
    return;
  }

  // Let the caller refresh the pool without a restart, so rotating a token in
  // the admin page takes effect on the next request.
  if (Array.isArray(payload.__tokens)) {
    pool.replace(payload.__tokens);
    delete payload.__tokens;
  }

  const picked = pool.pick();
  if (!picked) {
    // 503 rather than 500: the backend reads this as "fall back to the API
    // key", which is the whole point of the pool degrading instead of failing.
    send(res, 503, {
      error: {
        message: 'No subscription token available — every token is in cooldown.',
        code: 'no_token_available',
        tokens: pool.status(),
      },
    });
    return;
  }

  const started = Date.now();
  try {
    const result = await runTurn({
      token: picked.token,
      model: payload.model,
      messages: payload.messages ?? [],
      tools: payload.tools ?? [],
      maxTurns: payload.__maxTurns ?? 8,
    });

    pool.reportSuccess(picked.id);
    console.log(
      `[sidecar] ${picked.label} model=${result.model ?? 'default'} ` +
      `tools=${result.toolCalls.length} in=${result.usage.inputTokens} ` +
      `out=${result.usage.outputTokens} ${Date.now() - started}ms`,
    );

    send(res, 200, toOpenAiResponse(result));
  } catch (error) {
    const kind = error?.kind ?? 'unknown';
    pool.reportFailure(picked.id, kind, error?.message);
    console.error(`[sidecar] ${picked.label} failed (${kind}): ${error?.message}`);

    // 503 for pool problems so the backend falls back; 502 for anything else,
    // which is a real failure the operator should see rather than paper over.
    send(res, kind === 'unknown' ? 502 : 503, {
      error: { message: String(error?.message ?? error), code: kind, tokens: pool.status() },
    });
  }
}

const server = http.createServer(async (req, res) => {
  if (!authorized(req)) {
    send(res, 401, { error: { message: 'Unauthorized' } });
    return;
  }

  if (req.method === 'GET' && req.url === '/health') {
    send(res, 200, { ok: true, tokens: pool.status() });
    return;
  }

  if (req.method === 'POST' && req.url === '/v1/chat/completions') {
    await handleChatCompletions(req, res);
    return;
  }

  send(res, 404, { error: { message: 'Not found' } });
});

server.listen(PORT, HOST, () => {
  console.log(`[sidecar] listening on http://${HOST}:${PORT} — ${pool.status().length} token(s)`);
});
