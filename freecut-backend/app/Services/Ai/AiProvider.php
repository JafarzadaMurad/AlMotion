<?php

namespace App\Services\Ai;

/**
 * Common contract every chat provider implements. Callers always speak the
 * OpenAI Chat Completions schema (messages, tools, tool_choice). Each
 * provider is responsible for translating that to its native format on the
 * way out and normalizing the response back on the way in.
 */
interface AiProvider
{
    /** Stable identifier used as the discriminator in token_usages.provider. */
    public function name(): string;

    /** Returns the list of model IDs this provider serves. */
    public function supportedModels(): array;

    public function supportsModel(string $model): bool;

    /**
     * Execute a chat completion. Providers receive both the raw JSON body
     * (so OpenAI can forward verbatim and preserve empty-object schemas like
     * `"parameters": {}`) and the decoded array (for providers that need to
     * translate the schema into a different shape, e.g. Anthropic/Gemini).
     *
     * @param string $rawJsonBody  Raw JSON the client posted
     * @param array  $payload      Same body, decoded as associative array
     * @param string $apiKey       Provider API key
     */
    public function chat(string $rawJsonBody, array $payload, string $apiKey): ChatResult;

    /** plans.* column that holds this provider's monthly token cap. */
    public function planQuotaColumn(): string;

    /** users.* column that tracks tokens consumed this month for this provider. */
    public function userUsageColumn(): string;

    /** Name of the admin Setting key holding the global API key for this provider. */
    public function apiKeySettingName(): string;

    /** Name of the env var holding the API key fallback for this provider. */
    public function apiKeyEnvVar(): string;
}
