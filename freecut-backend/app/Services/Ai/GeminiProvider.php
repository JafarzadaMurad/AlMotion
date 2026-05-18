<?php

namespace App\Services\Ai;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Str;

/**
 * Translates OpenAI Chat Completions calls into Google Gemini's
 * generateContent API and back. Shape differences vs OpenAI:
 *
 * - System message lives in a top-level `systemInstruction` (not inside
 *   messages).
 * - Messages -> `contents` with role 'user' or 'model' (no 'assistant'),
 *   each content has `parts` (text, inlineData for images, functionCall,
 *   functionResponse).
 * - Tools = [{functionDeclarations: [{name, description, parameters}]}].
 * - Vision: image_url data: URLs -> {inlineData: {mimeType, data}}.
 * - Tool calls: functionCall part in a model message; tool results are
 *   functionResponse parts in a user message.
 * - Each model has its own URL: /v1beta/models/{model}:generateContent.
 * - Auth via `x-goog-api-key` header.
 * - finishReason 'STOP' -> 'stop', tool-call presence -> 'tool_calls',
 *   'MAX_TOKENS' -> 'length'.
 * - Usage: promptTokenCount + candidatesTokenCount -> prompt/completion.
 *
 * We expose three logical model IDs to the rest of the app:
 *   gemini-3.1-pro-high  - 3.1 Pro Preview with thinkingBudget = -1 (dynamic)
 *   gemini-3.1-pro-low   - 3.1 Pro Preview with thinkingBudget = 1024 (capped)
 *   gemini-3-flash       - 3 Flash Preview
 * The "high"/"low" split is our own naming; both map to the same upstream
 * API model and differ only in thinkingConfig.thinkingBudget.
 */
class GeminiProvider implements AiProvider
{
    /**
     * Internal model ID -> [api_model, thinking_budget|null].
     * thinking_budget: -1 = dynamic max, integer = explicit cap, null = omit.
     */
    private const MODEL_MAP = [
        'gemini-3.1-pro-high' => ['model' => 'gemini-3.1-pro-preview', 'thinking_budget' => -1],
        'gemini-3.1-pro-low' => ['model' => 'gemini-3.1-pro-preview', 'thinking_budget' => 1024],
        'gemini-3-flash' => ['model' => 'gemini-3-flash-preview', 'thinking_budget' => null],
    ];

    public function name(): string
    {
        return 'gemini';
    }

    public function supportedModels(): array
    {
        return array_keys(self::MODEL_MAP);
    }

    public function supportsModel(string $model): bool
    {
        return array_key_exists($model, self::MODEL_MAP);
    }

    public function chat(string $rawJsonBody, array $payload, string $apiKey): ChatResult
    {
        $requestedModel = $payload['model'] ?? 'gemini-3-flash';
        $mapping = self::MODEL_MAP[$requestedModel] ?? self::MODEL_MAP['gemini-3-flash'];
        $apiModel = $mapping['model'];

        $geminiPayload = $this->translateRequest($payload, $mapping['thinking_budget']);

        $url = "https://generativelanguage.googleapis.com/v1beta/models/{$apiModel}:generateContent";

        $response = Http::timeout(120)
            ->withHeaders([
                'x-goog-api-key' => $apiKey,
                'content-type' => 'application/json',
            ])
            ->post($url, $geminiPayload);

        $rawData = $response->json() ?? [];

        if ($response->successful()) {
            $normalized = $this->translateResponse($rawData, $requestedModel);
        } else {
            $normalized = [
                'error' => [
                    'message' => $rawData['error']['message'] ?? 'Gemini request failed',
                    'type' => $rawData['error']['status'] ?? 'gemini_error',
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
        return 'gemini_tokens_monthly';
    }

    public function userUsageColumn(): string
    {
        return 'gemini_tokens_used_this_month';
    }

    public function apiKeySettingName(): string
    {
        return 'gemini_api_key';
    }

    public function apiKeyEnvVar(): string
    {
        return 'GEMINI_API_KEY';
    }

    /**
     * OpenAI Chat Completions request -> Gemini generateContent request.
     */
    private function translateRequest(array $openai, ?int $thinkingBudget): array
    {
        $systemParts = [];
        $contents = [];

        // Buffer tool results between non-tool messages so we can flush them
        // into one user-role content (Gemini wants all functionResponse
        // parts together).
        $pendingFunctionResponses = [];

        $flushResponses = function () use (&$pendingFunctionResponses, &$contents) {
            if (!empty($pendingFunctionResponses)) {
                $contents[] = ['role' => 'user', 'parts' => $pendingFunctionResponses];
                $pendingFunctionResponses = [];
            }
        };

        // We need to remember the function name a given tool_call_id was for,
        // because Gemini's functionResponse requires name (not just id).
        $toolCallIdToName = [];

        foreach ($openai['messages'] ?? [] as $msg) {
            $role = $msg['role'] ?? 'user';

            if ($role === 'system') {
                $flushResponses();
                $systemParts[] = $this->stringifyContent($msg['content'] ?? '');
                continue;
            }

            if ($role === 'tool') {
                $callId = $msg['tool_call_id'] ?? '';
                $name = $toolCallIdToName[$callId] ?? $callId;
                $pendingFunctionResponses[] = [
                    'functionResponse' => [
                        'name' => $name,
                        'response' => [
                            'content' => $this->stringifyContent($msg['content'] ?? ''),
                        ],
                    ],
                ];
                continue;
            }

            $flushResponses();

            if ($role === 'assistant') {
                $parts = [];
                $text = $this->stringifyContent($msg['content'] ?? '');
                if ($text !== '') {
                    $parts[] = ['text' => $text];
                }
                foreach ($msg['tool_calls'] ?? [] as $call) {
                    $callId = $call['id'] ?? Str::uuid()->toString();
                    $name = $call['function']['name'] ?? '';
                    $toolCallIdToName[$callId] = $name;
                    $args = $call['function']['arguments'] ?? '{}';
                    $decoded = is_array($args) ? $args : (json_decode($args, true) ?: []);
                    $parts[] = [
                        'functionCall' => [
                            'name' => $name,
                            'args' => (object) $decoded,
                        ],
                    ];
                }
                if (empty($parts)) {
                    $parts[] = ['text' => ''];
                }
                $contents[] = ['role' => 'model', 'parts' => $parts];
                continue;
            }

            // user (string or array of blocks)
            $contents[] = ['role' => 'user', 'parts' => $this->translateUserParts($msg['content'] ?? '')];
        }

        $flushResponses();

        $request = ['contents' => $contents];

        if (!empty($systemParts)) {
            $request['systemInstruction'] = [
                'parts' => [['text' => implode("\n\n", $systemParts)]],
            ];
        }

        if (!empty($openai['tools'])) {
            $request['tools'] = [['functionDeclarations' => $this->translateTools($openai['tools'])]];
        }

        $generationConfig = [];
        if (isset($openai['temperature'])) {
            $generationConfig['temperature'] = $openai['temperature'];
        }
        if (isset($openai['max_tokens'])) {
            $generationConfig['maxOutputTokens'] = $openai['max_tokens'];
        }
        if ($thinkingBudget !== null) {
            $generationConfig['thinkingConfig'] = ['thinkingBudget' => $thinkingBudget];
        }
        if (!empty($generationConfig)) {
            $request['generationConfig'] = $generationConfig;
        }

        return $request;
    }

    private function translateUserParts(mixed $content): array
    {
        if (is_string($content)) {
            return [['text' => $content]];
        }
        if (!is_array($content)) {
            return [['text' => (string) $content]];
        }
        $parts = [];
        foreach ($content as $block) {
            if (!is_array($block)) {
                $parts[] = ['text' => (string) $block];
                continue;
            }
            $type = $block['type'] ?? null;
            if ($type === 'text') {
                $parts[] = ['text' => (string) ($block['text'] ?? '')];
            } elseif ($type === 'image_url') {
                $url = $block['image_url']['url'] ?? '';
                $parsed = $this->parseDataUrl($url);
                if ($parsed) {
                    $parts[] = [
                        'inlineData' => [
                            'mimeType' => $parsed['media_type'],
                            'data' => $parsed['data'],
                        ],
                    ];
                } else {
                    // Hosted image URL — Gemini supports fileData for some
                    // forms but plain URLs aren't accepted, so fall back to
                    // a text reference rather than failing the whole call.
                    $parts[] = ['text' => "[image: {$url}]"];
                }
            }
        }
        return $parts ?: [['text' => '']];
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
        $header = substr($url, 5, $comma - 5);
        $data = substr($url, $comma + 1);
        $parts = explode(';', $header);
        $mediaType = $parts[0] ?? 'image/png';
        return ['media_type' => $mediaType, 'data' => $data];
    }

    private function translateTools(array $tools): array
    {
        $out = [];
        foreach ($tools as $tool) {
            $fn = $tool['function'] ?? $tool;
            $params = $fn['parameters'] ?? ['type' => 'object', 'properties' => (object) []];
            if (is_array($params) && isset($params['properties']) && $params['properties'] === []) {
                $params['properties'] = (object) [];
            }
            $out[] = [
                'name' => $fn['name'] ?? '',
                'description' => $fn['description'] ?? '',
                'parameters' => $params,
            ];
        }
        return $out;
    }

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
     * Gemini generateContent response -> OpenAI Chat Completion response.
     */
    private function translateResponse(array $gemini, string $internalModel): array
    {
        $candidate = $gemini['candidates'][0] ?? [];
        $parts = $candidate['content']['parts'] ?? [];

        $textParts = [];
        $toolCalls = [];

        foreach ($parts as $part) {
            if (isset($part['text'])) {
                $textParts[] = (string) $part['text'];
            } elseif (isset($part['functionCall'])) {
                $fc = $part['functionCall'];
                $toolCalls[] = [
                    'id' => 'call_' . Str::random(10),
                    'type' => 'function',
                    'function' => [
                        'name' => $fc['name'] ?? '',
                        'arguments' => json_encode($fc['args'] ?? (object) [], JSON_UNESCAPED_UNICODE),
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

        $rawFinish = $candidate['finishReason'] ?? 'STOP';
        $finishReason = !empty($toolCalls)
            ? 'tool_calls'
            : match ($rawFinish) {
                'MAX_TOKENS' => 'length',
                'SAFETY', 'RECITATION' => 'content_filter',
                default => 'stop',
            };

        $usage = $gemini['usageMetadata'] ?? [];
        $promptTokens = (int) ($usage['promptTokenCount'] ?? 0);
        $completionTokens = (int) ($usage['candidatesTokenCount'] ?? 0);
        $totalTokens = (int) ($usage['totalTokenCount'] ?? ($promptTokens + $completionTokens));

        return [
            'id' => 'gemini_' . Str::random(10),
            'object' => 'chat.completion',
            'created' => time(),
            'model' => $internalModel,
            'choices' => [[
                'index' => 0,
                'message' => $message,
                'finish_reason' => $finishReason,
            ]],
            'usage' => [
                'prompt_tokens' => $promptTokens,
                'completion_tokens' => $completionTokens,
                'total_tokens' => $totalTokens,
            ],
        ];
    }
}
