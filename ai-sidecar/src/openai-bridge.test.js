import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
  messagesToPrompt,
  extractSystemPrompt,
  stripToolPrefix,
  toOpenAiResponse,
  classifyError,
  TOOL_PREFIX,
} from './openai-bridge.js';

describe('messagesToPrompt', () => {
  test('labels roles so the transcript does not read as one voice', () => {
    const prompt = messagesToPrompt([
      { role: 'user', content: 'add a zoom' },
      { role: 'assistant', content: 'which clip?' },
      { role: 'user', content: 'the first one' },
    ]);
    assert.equal(prompt, 'User: add a zoom\n\nAssistant: which clip?\n\nUser: the first one');
  });

  test('leaves system messages out — they travel as systemPrompt', () => {
    const prompt = messagesToPrompt([
      { role: 'system', content: 'you are an editor' },
      { role: 'user', content: 'hi' },
    ]);
    assert.equal(prompt, 'User: hi');
  });

  test('keeps tool calls visible on an assistant turn with null content', () => {
    // OpenAI sends content: null when the turn is purely tool calls. Dropping
    // it would hide from the model that it already made the call.
    const prompt = messagesToPrompt([
      {
        role: 'assistant',
        content: null,
        tool_calls: [{ function: { name: 'apply_animation', arguments: '{"preset":"zoom-in"}' } }],
      },
    ]);
    assert.match(prompt, /called: apply_animation\(\{"preset":"zoom-in"\}\)/);
  });

  test('carries tool results back, or the model re-calls the same tool', () => {
    const prompt = messagesToPrompt([
      { role: 'tool', tool_call_id: 'call_1', content: '{"clips":2}' },
    ]);
    assert.match(prompt, /Tool result \(call_1\): \{"clips":2\}/);
  });

  test('flattens multi-part content into text', () => {
    const prompt = messagesToPrompt([
      { role: 'user', content: [{ type: 'text', text: 'line one' }, { type: 'text', text: 'line two' }] },
    ]);
    assert.equal(prompt, 'User: line one\nline two');
  });

  test('survives empty and missing input', () => {
    assert.equal(messagesToPrompt([]), '');
    assert.equal(messagesToPrompt(undefined), '');
  });
});

describe('extractSystemPrompt', () => {
  test('joins every system message in order', () => {
    const system = extractSystemPrompt([
      { role: 'system', content: 'first' },
      { role: 'user', content: 'ignored' },
      { role: 'system', content: 'second' },
    ]);
    assert.equal(system, 'first\n\nsecond');
  });

  test('returns empty when there is none', () => {
    assert.equal(extractSystemPrompt([{ role: 'user', content: 'hi' }]), '');
  });
});

describe('stripToolPrefix', () => {
  test('removes the MCP namespace so callers see the name they sent', () => {
    assert.equal(stripToolPrefix(`${TOOL_PREFIX}apply_effect`), 'apply_effect');
  });

  test('leaves an unprefixed name alone', () => {
    assert.equal(stripToolPrefix('apply_effect'), 'apply_effect');
  });
});

describe('toOpenAiResponse', () => {
  test('reports finish_reason tool_calls so the chat loop runs them', () => {
    // The editor keys off this to decide whether to execute and come back;
    // reporting stop here strands the conversation.
    const response = toOpenAiResponse({
      text: '',
      toolCalls: [{ id: 'x', name: `${TOOL_PREFIX}apply_animation`, args: { preset: 'ken-burns' } }],
      usage: { inputTokens: 10, outputTokens: 4 },
    });
    assert.equal(response.choices[0].finish_reason, 'tool_calls');
    assert.equal(response.choices[0].message.tool_calls[0].function.name, 'apply_animation');
    assert.equal(response.choices[0].message.tool_calls[0].function.arguments, '{"preset":"ken-burns"}');
  });

  test('sends null content beside tool calls, matching OpenAI', () => {
    const response = toOpenAiResponse({ text: '', toolCalls: [{ name: 'a', args: {} }] });
    assert.equal(response.choices[0].message.content, null);
  });

  test('reports stop and plain text when no tool was called', () => {
    const response = toOpenAiResponse({ text: 'done', toolCalls: [], usage: { inputTokens: 3, outputTokens: 1 } });
    assert.equal(response.choices[0].finish_reason, 'stop');
    assert.equal(response.choices[0].message.content, 'done');
    assert.equal(response.choices[0].message.tool_calls, undefined);
  });

  test('totals usage the way the backend meters it', () => {
    const response = toOpenAiResponse({ text: 'x', toolCalls: [], usage: { inputTokens: 100, outputTokens: 25 } });
    assert.deepEqual(response.usage, { prompt_tokens: 100, completion_tokens: 25, total_tokens: 125 });
  });

  test('serialises object arguments and passes strings through untouched', () => {
    const response = toOpenAiResponse({
      toolCalls: [{ name: 'a', args: { x: 1 } }, { name: 'b', args: '{"y":2}' }],
    });
    assert.equal(response.choices[0].message.tool_calls[0].function.arguments, '{"x":1}');
    assert.equal(response.choices[0].message.tool_calls[1].function.arguments, '{"y":2}');
  });

  test('gives every tool call an id, since OpenAI clients key results by it', () => {
    const response = toOpenAiResponse({ toolCalls: [{ name: 'a', args: {} }, { name: 'b', args: {} }] });
    const [first, second] = response.choices[0].message.tool_calls;
    assert.ok(first.id && second.id);
    assert.notEqual(first.id, second.id);
  });
});

describe('classifyError', () => {
  test('recognises a rate limit however it is worded', () => {
    assert.equal(classifyError(new Error('429 Too Many Requests')), 'rate_limited');
    assert.equal(classifyError(new Error('usage limit reached')), 'rate_limited');
  });

  test('recognises a rejected or expired token', () => {
    assert.equal(classifyError(new Error('401 Unauthorized')), 'auth');
    assert.equal(classifyError(new Error('token expired')), 'auth');
  });

  test('does not guess at anything else', () => {
    // Unknown must stay unknown: benching a token for a bad request would
    // take the pool down over a caller mistake.
    assert.equal(classifyError(new Error('socket hang up')), 'unknown');
  });
});
