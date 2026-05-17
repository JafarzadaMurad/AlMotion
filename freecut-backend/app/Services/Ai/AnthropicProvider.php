<?php

namespace App\Services\Ai;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Translates OpenAI-shaped Chat Completion calls into Anthropic's Messages
 * API and back. The shape differences are non-trivial:
 *
 * - OpenAI: system is a regular message; Anthropic: top-level `system` field.
 * - OpenAI: tools = [{type:'function', function:{name, description, parameters}}]
 *   Anthropic: tools = [{name, description, input_schema}]
 * - OpenAI: assistant tool calls live on `tool_calls`; tool results come
 *   back as separate messages with role 'tool' and tool_call_id.
 *   Anthropic: tool calls are `tool_use` blocks inside the assistant
 *   message content; tool results are `tool_result` blocks inside a
 *   user message content.
 * - OpenAI vision: {type:'image_url', image_url:{url:'data:image/png;base64,...'}}
 *   Anthropic: {type:'image', source:{type:'base64', media_type, data}}
 * - Anthropic requires `max_tokens`.
 *
 * Frontend never sees any of this; it keeps sending and receiving the
 * OpenAI schema.
 */
class AnthropicProvider implements AiProvider
{
    private const MODELS = [
        'claude-opus-4-7',
        'claude-sonnet-4-6',
        'claude-haiku-4-5',
        'claude-haiku-4-5-20251001',
    ];

    private const DEFAULT_MAX_TOKENS = 4096;

    public function name(): string
    {
        return 'anthropic';
    }

    public function supportedModels(): array
    {
        return self::MODELS;
    }

    public function supportsModel(string $model): bool
    {
        return in_array($model, self::MODELS, true);
    }

    public function chat(string $rawJsonBody, array $payload, string $apiKey): ChatResult
    {
        $anthropicPayload = $this->translateRequest($payload);

        $response = Http::timeout(120)
            ->withHeaders([
                'x-api-key' => $apiKey,
                'anthropic-version' => '2023-06-01',
                'content-type' => 'application/json',
            ])
            ->post('https://api.anthropic.com/v1/messages', $anthropicPayload);

        $rawData = $response->json() ?? [];

        if ($response->successful()) {
            $normalized = $this->translateResponse($rawData, $payload['model'] ?? '');
        } else {
            // Surface the Anthropic error in an OpenAI-ish envelope so the
            // frontend can render it the same way it renders OpenAI errors.
            $normalized = [
                'error' => [
                    'message' => $rawData['error']['message'] ?? 'Anthropic request failed',
                    'type' => $rawData['error']['type'] ?? 'anthropic_error',
                ],
            ];
        }

        return new ChatResult(
            data: $normalized,
            status: $response->status(),
        );
    }

    public function planQuotaColumn(): string
    {
        return 'anthropic_tokens_monthly';
    }

    public function userUsageColumn(): string
    {
        return 'anthropic_tokens_used_this_month';
    }

    public function apiKeySettingName(): string
    {
        return 'anthropic_api_key';
    }

    public function apiKeyEnvVar(): string
    {
        return 'ANTHROPIC_API_KEY';
    }

    /**
     * OpenAI Chat Completions request -> Anthropic Messages request.
     */
    private function translateRequest(array $openai): array
    {
        $systemParts = [];
        $messages = [];

        // Walk OpenAI messages in order. We collect a running list of
        // tool_result blocks so we can flush them into one user message when
        // we hit the next non-tool message.
        $pendingToolResults = [];

        $flushToolResults = function () use (&$pendingToolResults, &$messages) {
            if (!empty($pendingToolResults)) {
                $messages[] = ['role' => 'user', 'content' => $pendingToolResults];
                $pendingToolResults = [];
            }
        };

        foreach ($openai['messages'] ?? [] as $msg) {
            $role = $msg['role'] ?? 'user';

            if ($role === 'system') {
                $flushToolResults();
                $systemParts[] = $this->stringifyContent($msg['content'] ?? '');
                continue;
            }

            if ($role === 'tool') {
                $pendingToolResults[] = [
                    'type' => 'tool_result',
                    'tool_use_id' => $msg['tool_call_id'] ?? '',
                    'content' => $this->stringifyContent($msg['content'] ?? ''),
                ];
                continue;
            }

            $flushToolResults();

            if ($role === 'assistant') {
                $content = [];
                $text = $this->stringifyContent($msg['content'] ?? '');
                if ($text !== '') {
                    $content[] = ['type' => 'text', 'text' => $text];
                }
                foreach ($msg['tool_calls'] ?? [] as $call) {
                    $args = $call['function']['arguments'] ?? '{}';
                    $decoded = is_array($args) ? $args : (json_decode($args, true) ?: []);
                    $content[] = [
                        'type' => 'tool_use',
                        'id' => $call['id'] ?? Str::uuid()->toString(),
                        'name' => $call['function']['name'] ?? '',
                        'input' => (object) $decoded, // empty -> {} not []
                    ];
                }
                if (empty($content)) {
                    $content[] = ['type' => 'text', 'text' => ''];
                }
                $messages[] = ['role' => 'assistant', 'content' => $content];
                continue;
            }

            // user
            $messages[] = ['role' => 'user', 'content' => $this->translateUserContent($msg['content'] ?? '')];
        }

        $flushToolResults();

        $request = [
            'model' => $openai['model'] ?? 'claude-sonnet-4-6',
            'max_tokens' => $openai['max_tokens'] ?? self::DEFAULT_MAX_TOKENS,
            'messages' => $messages,
        ];

        if (!empty($systemParts)) {
            $request['system'] = implode("\n\n", $systemParts);
        }

        if (!empty($openai['tools'])) {
            $request['tools'] = $this->translateTools($openai['tools']);
        }

        if (isset($openai['temperature'])) {
            $request['temperature'] = $openai['temperature'];
        }

        return $request;
    }

    /**
     * User-role content can be a plain string or an array of content blocks
     * (text + image_url). Translate image_url -> image, leave text alone.
     */
    private function translateUserContent(mixed $content): array|string
    {
        if (is_string($content)) {
            return $content;
        }
        if (!is_array($content)) {
            return (string) $content;
        }
        $out = [];
        foreach ($content as $block) {
            if (!is_array($block)) {
                $out[] = ['type' => 'text', 'text' => (string) $block];
                continue;
            }
            $type = $block['type'] ?? null;
            if ($type === 'text') {
                $out[] = ['type' => 'text', 'text' => (string) ($block['text'] ?? '')];
            } elseif ($type === 'image_url') {
                $url = $block['image_url']['url'] ?? '';
                $parsed = $this->parseDataUrl($url);
                if ($parsed) {
                    $out[] = [
                        'type' => 'image',
                        'source' => [
                            'type' => 'base64',
                            'media_type' => $parsed['media_type'],
                            'data' => $parsed['data'],
                        ],
                    ];
                } else {
                    // Anthropic also accepts URL sources for hosted images.
                    $out[] = [
                        'type' => 'image',
                        'source' => ['type' => 'url', 'url' => $url],
                    ];
                }
            }
        }
        return $out ?: [['type' => 'text', 'text' => '']];
    }

    private function parseDataUrl(string $url): ?array
    {
        if (!Str::startsWith($url, 'data:')) {
            return null;
        }
        $comma = strpos($url, ',');
        if ($comma === false) {
            return null;
        }
        $header = substr($url, 5, $comma - 5); // strip "data:" and trailing comma
        $data = substr($url, $comma + 1);
        // header looks like "image/png;base64"
        $parts = explode(';', $header);
        $mediaType = $parts[0] ?? 'image/png';
        return ['media_type' => $mediaType, 'data' => $data];
    }

    /**
     * OpenAI tools schema -> Anthropic tools schema.
     */
    private function translateTools(array $tools): array
    {
        $out = [];
        foreach ($tools as $tool) {
            $fn = $tool['function'] ?? $tool;
            $params = $fn['parameters'] ?? ['type' => 'object', 'properties' => (object) []];
            // Coerce empty array to empty object so JSON encodes properly.
            if (is_array($params) && isset($params['properties']) && $params['properties'] === []) {
                $params['properties'] = (object) [];
            }
            $out[] = [
                'name' => $fn['name'] ?? '',
                'description' => $fn['description'] ?? '',
                'input_schema' => $params,
            ];
        }
        return $out;
    }

    /**
     * Coerce mixed content (string or array of {type,text} blocks) to a
     * single string for use in system / tool_result payloads.
     */
    private function stringifyContent(mixed $content): string
    {
        if (is_string($content)) {
            return $content;
        }
        if (!is_array($content)) {
            return (string) $content;
        }
        $parts = [];
        foreach ($content as $block) {
            if (is_string($block)) {
                $parts[] = $block;
            } elseif (is_array($block) && ($block['type'] ?? null) === 'text') {
                $parts[] = (string) ($block['text'] ?? '');
            }
        }
        return implode("\n", $parts);
    }

    /**
     * Anthropic Messages response -> OpenAI Chat Completion response.
     */
    private function translateResponse(array $anthropic, string $model): array
    {
        $textParts = [];
        $toolCalls = [];

        foreach ($anthropic['content'] ?? [] as $block) {
            $type = $block['type'] ?? null;
            if ($type === 'text') {
                $textParts[] = (string) ($block['text'] ?? '');
            } elseif ($type === 'tool_use') {
                $toolCalls[] = [
                    'id' => $block['id'] ?? Str::uuid()->toString(),
                    'type' => 'function',
                    'function' => [
                        'name' => $block['name'] ?? '',
                        'arguments' => json_encode($block['input'] ?? (object) [], JSON_UNESCAPED_UNICODE),
                    ],
                ];
            }
        }

        $message = [
            'role' => 'assistant',
            'content' => $textParts ? implode('', $textParts) : null,
        ];
        if (!empty($toolCalls)) {
            $message['tool_calls'] = $toolCalls;
        }

        $stopReason = $anthropic['stop_reason'] ?? 'end_turn';
        $finishReason = match ($stopReason) {
            'tool_use' => 'tool_calls',
            'max_tokens' => 'length',
            'end_turn', 'stop_sequence' => 'stop',
            default => 'stop',
        };

        $usage = $anthropic['usage'] ?? [];
        $promptTokens = (int) ($usage['input_tokens'] ?? 0);
        $completionTokens = (int) ($usage['output_tokens'] ?? 0);

        return [
            'id' => $anthropic['id'] ?? ('msg_' . Str::random(8)),
            'object' => 'chat.completion',
            'created' => time(),
            'model' => $anthropic['model'] ?? $model,
            'choices' => [[
                'index' => 0,
                'message' => $message,
                'finish_reason' => $finishReason,
            ]],
            'usage' => [
                'prompt_tokens' => $promptTokens,
                'completion_tokens' => $completionTokens,
                'total_tokens' => $promptTokens + $completionTokens,
            ],
        ];
    }
}
