import { TOOL_PREFIX, messagesToPrompt, extractSystemPrompt, classifyError } from './openai-bridge.js';

/**
 * Run one turn on a Claude Code subscription and return it in OpenAI terms.
 *
 * The load-bearing difference from a server-side agent: **this sidecar never
 * executes a tool.** The editor's tools run in the browser — they move clips,
 * apply effects, open pickers — so the protocol is OpenAI's: return the tool
 * calls and let the caller come back with results in the next request.
 *
 * The harness has no such notion; it calls a tool and waits for the answer.
 * So the bridged handlers exist only to make the tools callable, and the run
 * is aborted the moment the model emits tool_use blocks. Whatever a handler
 * returns is discarded — it is there to satisfy the SDK's shape, not to work.
 */
export async function runTurn({ token, model, messages, tools, maxTurns = 8, signal, timeoutMs = 240_000 }) {
  const { query, tool, createSdkMcpServer } = await import('@anthropic-ai/claude-agent-sdk');

  const systemPrompt = extractSystemPrompt(messages);
  const prompt = messagesToPrompt(messages);

  const mcpServers = {};
  const allowedTools = [];

  if (Array.isArray(tools) && tools.length > 0) {
    mcpServers.almotion = createSdkMcpServer({
      name: 'almotion',
      version: '1.0.0',
      tools: tools.map((entry) => {
        const fn = entry?.function ?? entry;
        return tool(
          String(fn?.name ?? 'unnamed'),
          String(fn?.description ?? fn?.name ?? ''),
          // The SDK accepts a JSON Schema object here. The editor already
          // ships JSON Schema for all 30 tools, so nothing needs restating
          // in zod — which is what forced the reference implementation to
          // refuse tools it could not translate.
          fn?.parameters ?? { type: 'object', properties: {} },
          async () => ({
            content: [{ type: 'text', text: 'pending: executed by the client' }],
          }),
        );
      }),
    });
    allowedTools.push(`${TOOL_PREFIX}*`);
  }

  const controller = new AbortController();
  if (signal) signal.addEventListener('abort', () => controller.abort(), { once: true });

  // The harness is a subprocess and can hang rather than fail — a missing
  // `claude` binary makes it wait indefinitely instead of erroring. Without a
  // deadline that becomes a request the editor never gets an answer to.
  let timedOut = false;
  const deadline = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const run = query({
    prompt,
    options: {
      ...(model ? { model } : {}),
      ...(systemPrompt ? { systemPrompt } : {}),
      mcpServers,
      allowedTools,
      // Nothing here can wait on a human at a terminal, and the harness's own
      // bash and file tools have no business in an editor request — only the
      // tools handed over are allowed.
      permissionMode: 'dontAsk',
      maxTurns,
      abortController: controller,
      // `env` replaces rather than merges, so the base has to be copied or the
      // subprocess loses PATH and HOME. The API key is stripped deliberately:
      // if present the CLI silently prefers it and bills the API — the exact
      // thing running on a subscription is meant to avoid.
      env: {
        ...process.env,
        ANTHROPIC_API_KEY: undefined,
        ANTHROPIC_AUTH_TOKEN: undefined,
        CLAUDE_CODE_OAUTH_TOKEN: token,
      },
    },
  });

  const textParts = [];
  const toolCalls = [];
  let usage = { inputTokens: 0, outputTokens: 0 };
  let actualModel = null;
  let aborted = false;

  try {
    for await (const message of run) {
      if (message.type === 'system' && message.subtype === 'init') {
        if (typeof message.model === 'string') actualModel = message.model;
        continue;
      }

      if (message.type === 'assistant') {
        for (const block of message.message?.content ?? []) {
          if (block.type === 'text' && block.text) textParts.push(block.text);
          if (block.type === 'tool_use') {
            toolCalls.push({ id: block.id, name: block.name, args: block.input ?? {} });
          }
        }
        // Hand control back to the browser as soon as the model wants a tool.
        // Letting the run continue would have the harness invoke the stub
        // handler and reason on top of a fabricated result.
        if (toolCalls.length > 0) {
          aborted = true;
          controller.abort();
          break;
        }
        continue;
      }

      if (message.type === 'result') {
        if (message.subtype && message.subtype !== 'success') {
          throw new Error(`Claude Code returned ${message.subtype}`);
        }
        if (typeof message.result === 'string' && message.result.trim()) {
          textParts.length = 0;
          textParts.push(message.result);
        }
        const reported = message.usage ?? {};
        usage = {
          inputTokens: Number(reported.input_tokens ?? 0),
          outputTokens: Number(reported.output_tokens ?? 0),
        };
      }
    }
  } catch (error) {
    if (timedOut) {
      const wrapped = new Error(`Claude Code harness did not respond within ${Math.round(timeoutMs / 1000)}s`);
      // Not the token's fault, so the pool must not bench it — a missing CLI
      // or a slow machine would otherwise take every token out of service.
      wrapped.kind = 'unknown';
      throw wrapped;
    }
    // An abort we asked for is the tool-call path completing, not a failure.
    if (!aborted) {
      const kind = classifyError(error);
      const wrapped = new Error(String(error?.message ?? error));
      wrapped.kind = kind;
      throw wrapped;
    }
  } finally {
    clearTimeout(deadline);
    try { run.close?.(); } catch { /* already closed */ }
  }

  return {
    text: textParts.join('').trim(),
    toolCalls,
    usage,
    model: actualModel ?? model ?? null,
  };
}
