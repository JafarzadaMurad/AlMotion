<?php

namespace App\Services\Ai;

use Illuminate\Support\Facades\Http;

class OpenAiProvider implements AiProvider
{
    private const MODELS = [
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4o',
        'gpt-4o-mini',
        'o4-mini',
        'o3-mini',
        'gpt-5',
        'gpt-5-mini',
        'gpt-5-nano',
        'gpt-5.4',
        'gpt-5.4-pro',
        'gpt-5.4-mini',
        'gpt-5.4-nano',
    ];

    public function name(): string
    {
        return 'openai';
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
        // Forward the raw bytes so empty-object schemas like
        // `"parameters": {"type":"object","properties":{}}` survive intact.
        // Round-tripping through array <-> JSON converts an empty
        // associative array into [], which OpenAI rejects with
        // "Invalid schema for function ...: [] is not of type 'object'".
        $response = Http::timeout(120)
            ->withHeaders([
                'Authorization' => 'Bearer ' . $apiKey,
                'Content-Type' => 'application/json',
            ])
            ->withBody($rawJsonBody, 'application/json')
            ->post('https://api.openai.com/v1/chat/completions');

        return new ChatResult(
            data: $response->json() ?? [],
            status: $response->status(),
        );
    }

    public function planQuotaColumn(): string
    {
        return 'max_ai_tokens_monthly';
    }

    public function userUsageColumn(): string
    {
        return 'tokens_used_this_month';
    }

    public function apiKeySettingName(): string
    {
        return 'openai_api_key';
    }

    public function apiKeyEnvVar(): string
    {
        return 'OPENAI_API_KEY';
    }
}
