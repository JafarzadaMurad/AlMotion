/**
 * Translation between the OpenAI Chat Completions schema the editor speaks and
 * what the Claude Code harness accepts.
 *
 * Kept free of any SDK or network import so it can be unit-tested directly —
 * this is where the subtle mistakes live, not in the transport.
 */

/**
 * Flatten an OpenAI `messages` array into the single user turn the harness
 * takes, preserving who said what.
 *
 * The harness has no conversation array: it takes one prompt. Rather than
 * dropping history we render it as a transcript, which keeps multi-turn
 * context and tool results intact. Roles are labelled because an unlabelled
 * concatenation reads as one person contradicting themselves.
 */
export function messagesToPrompt(messages) {
  const parts = [];

  for (const message of messages ?? []) {
    const role = message?.role;
    if (role === 'system') continue; // carried separately as systemPrompt

    const text = contentToText(message?.content);

    if (role === 'assistant') {
      // An assistant turn that called tools has null content; the calls
      // themselves are the content and the model needs to see it made them.
      const calls = (message.tool_calls ?? [])
        .map((call) => `${call.function?.name}(${call.function?.arguments ?? '{}'})`)
        .join(', ');
      const body = [text, calls && `[called: ${calls}]`].filter(Boolean).join('\n');
      if (body) parts.push(`Assistant: ${body}`);
      continue;
    }

    if (role === 'tool') {
      // Tool results must reach the model or it re-calls the same tool.
      parts.push(`Tool result (${message.tool_call_id ?? 'unknown'}): ${text}`);
      continue;
    }

    if (text) parts.push(`User: ${text}`);
  }

  return parts.join('\n\n');
}

/** OpenAI content is a string or an array of typed parts; we want plain text. */
function contentToText(content) {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return content
    .map((part) => (typeof part === 'string' ? part : part?.type === 'text' ? part.text : ''))
    .filter(Boolean)
    .join('\n');
}

/** Concatenate every system message, in order, into the harness system prompt. */
export function extractSystemPrompt(messages) {
  return (messages ?? [])
    .filter((message) => message?.role === 'system')
    .map((message) => contentToText(message.content))
    .filter(Boolean)
    .join('\n\n');
}

/** MCP namespaces tool names; strip it so callers see the names they sent. */
export const TOOL_PREFIX = 'mcp__almotion__';

export function stripToolPrefix(name) {
  return String(name ?? '').replace(new RegExp(`^${TOOL_PREFIX}`), '');
}

/**
 * Shape a finished turn as an OpenAI chat completion.
 *
 * `finish_reason` matters more than it looks: the editor's chat loop keys off
 * `tool_calls` to decide whether to run tools and come back, so reporting
 * `stop` on a turn that called one would strand the conversation.
 */
export function toOpenAiResponse({ model, text, toolCalls, usage }) {
  const calls = (toolCalls ?? []).map((call, index) => ({
    id: call.id ?? `call_${index}_${Math.random().toString(36).slice(2, 10)}`,
    type: 'function',
    function: {
      name: stripToolPrefix(call.name),
      arguments: typeof call.args === 'string' ? call.args : JSON.stringify(call.args ?? {}),
    },
  }));

  const promptTokens = Number(usage?.inputTokens ?? 0);
  const completionTokens = Number(usage?.outputTokens ?? 0);

  return {
    id: `chatcmpl-${Math.random().toString(36).slice(2, 12)}`,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: model ?? 'claude-code-subscription',
    choices: [
      {
        index: 0,
        message: {
          role: 'assistant',
          // OpenAI sends null content alongside tool calls; the editor's
          // renderer treats an empty string as a blank assistant bubble.
          content: calls.length > 0 ? (text || null) : (text ?? ''),
          ...(calls.length > 0 && { tool_calls: calls }),
        },
        finish_reason: calls.length > 0 ? 'tool_calls' : 'stop',
      },
    ],
    usage: {
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: promptTokens + completionTokens,
    },
  };
}

/**
 * Classify a harness failure so the pool knows whether to bench the token and
 * for how long. Matching on message text is crude, but the SDK surfaces these
 * as plain errors and the alternative is treating an expired token as a
 * transient blip forever.
 */
export function classifyError(error) {
  const message = String(error?.message ?? error ?? '');
  if (/rate.?limit|429|usage limit|limit reached/i.test(message)) return 'rate_limited';
  if (/401|403|unauthor|invalid.*token|expired/i.test(message)) return 'auth';
  return 'unknown';
}
