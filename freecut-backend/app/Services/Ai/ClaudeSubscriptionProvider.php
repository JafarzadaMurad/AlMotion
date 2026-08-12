<?php

namespace App\Services\Ai;

use App\Models\Setting;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Runs chat on a Claude Code **subscription** instead of a metered API key.
 *
 * A subscription cannot be driven through /v1/messages — only through the
 * Claude Code harness, which is Node and has no PHP equivalent. Spawning the
 * bare CLI is not enough either: what makes tools work is the harness's
 * in-process MCP bridge, which only the Agent SDK provides.
 *
 * So the harness lives in a Node sidecar (`ai-sidecar/`) behind the same
 * OpenAI Chat Completions contract every other provider here speaks, and this
 * class is a thin HTTP hop to it. The editor's 30 browser-side tools travel as
 * ordinary OpenAI tool definitions and come back as ordinary tool_calls.
 *
 * Falling back is the point, not an afterthought: a subscription's rate limit
 * is sized for one person's day of work. When the sidecar reports every token
 * benched it answers 503, and OpenAiController is expected to retry the turn
 * on the API-key provider. Running out costs money, never function.
 */
class ClaudeSubscriptionProvider implements AiProvider
{
    /**
     * Which harness alias each Claude model maps to. The user picks a Claude
     * model as normal; whether it is billed to an API key or a subscription is
     * an operator decision, not something to duplicate in the model list.
     * Parallel model IDs were tried first and only moved the decision onto
     * users who have no basis to make it.
     */
    private const MODEL_MAP = [
        'claude-opus-5' => 'opus',
        'claude-sonnet-5' => 'sonnet',
        'claude-fable-5' => 'fable',
        'claude-haiku-4-5-20251001' => 'haiku',
        // Older ids still reachable, mapped onto the same harness tiers.
        'claude-opus-4-7' => 'opus',
        'claude-sonnet-4-6' => 'sonnet',
        'claude-haiku-4-5' => 'haiku',
    ];

    public const MODE_SETTING = 'anthropic_mode';
    public const MODE_SUBSCRIPTION = 'subscription';

    private const DEFAULT_URL = 'http://127.0.0.1:8790';

    public function name(): string
    {
        return 'claude_subscription';
    }

    /**
     * Empty on purpose: these are Anthropic's models, already advertised by
     * AnthropicProvider. Listing them twice would double every Claude entry in
     * the admin plan form and the model picker.
     */
    public function supportedModels(): array
    {
        return [];
    }

    /**
     * Claims Claude models only while the operator has switched Anthropic to
     * subscription billing. Registered ahead of AnthropicProvider so that when
     * it does claim, it wins; when it does not, the API-key path is untouched.
     */
    public function supportsModel(string $model): bool
    {
        if (!isset(self::MODEL_MAP[$model])) {
            return false;
        }
        return Setting::get(self::MODE_SETTING) === self::MODE_SUBSCRIPTION;
    }

    /**
     * Token quota is shared with the API-key Anthropic provider on purpose:
     * both consume Claude, and splitting the columns would let a user exhaust
     * one budget and quietly continue on the other.
     */
    public function planQuotaColumn(): string
    {
        return 'max_anthropic_tokens_monthly';
    }

    public function userUsageColumn(): string
    {
        return 'anthropic_tokens_used_this_month';
    }

    /**
     * Not an API key — the "key" for this provider is the subscription token
     * list, which travels to the sidecar rather than to Anthropic. Kept on the
     * interface so the registry can treat every provider alike.
     */
    public function apiKeySettingName(): string
    {
        return 'claude_subscription_tokens';
    }

    public function apiKeyEnvVar(): string
    {
        return 'CLAUDE_SUB_TOKENS';
    }

    public function chat(string $rawJsonBody, array $payload, string $apiKey): ChatResult
    {
        $payload['model'] = self::MODEL_MAP[$payload['model'] ?? ''] ?? null;
        if ($payload['model'] === null) {
            unset($payload['model']);
        }

        // Tokens ride along with the request so rotating one in the admin page
        // takes effect immediately, without restarting the sidecar.
        $tokens = $this->tokens($apiKey);
        if (empty($tokens)) {
            return new ChatResult(
                ['error' => 'No Claude subscription token configured. Add one in admin settings.'],
                500,
            );
        }
        $payload['__tokens'] = $tokens;

        try {
            $response = Http::timeout((int) (Setting::get('claude_subscription_timeout') ?: 300))
                ->withHeaders($this->authHeaders())
                ->post($this->baseUrl() . '/v1/chat/completions', $payload);
        } catch (\Throwable $e) {
            Log::warning('Claude subscription sidecar unreachable', ['error' => $e->getMessage()]);
            // 503 so the caller treats it the same as an exhausted pool and
            // falls back, rather than surfacing a dead sidecar to the user.
            return new ChatResult(
                ['error' => 'Claude subscription sidecar is not reachable: ' . $e->getMessage()],
                503,
            );
        }

        return new ChatResult($response->json() ?? [], $response->status());
    }

    /** True when an operator has configured this path at all. */
    public function isConfigured(): bool
    {
        return !empty($this->tokens(null));
    }

    private function baseUrl(): string
    {
        return rtrim(Setting::get('claude_subscription_url') ?: env('SIDECAR_URL', self::DEFAULT_URL), '/');
    }

    private function authHeaders(): array
    {
        $secret = Setting::get('claude_subscription_secret') ?: env('SIDECAR_SECRET');
        return $secret ? ['Authorization' => 'Bearer ' . $secret] : [];
    }

    /**
     * Accepts either a JSON array of `{id, label, token}` or a single bare
     * token pasted straight from `claude setup-token`, so trying this out
     * does not require hand-writing JSON.
     *
     * @return array<int, array{id: string, label: string, token: string}>
     */
    private function tokens(?string $override): array
    {
        $raw = trim((string) ($override ?: Setting::get($this->apiKeySettingName()) ?: env($this->apiKeyEnvVar(), '')));
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        if (is_array($decoded)) {
            $tokens = [];
            foreach (array_values($decoded) as $index => $entry) {
                if (!is_array($entry) || empty($entry['token'])) {
                    continue;
                }
                $tokens[] = [
                    'id' => (string) ($entry['id'] ?? 'token-' . $index),
                    'label' => (string) ($entry['label'] ?? $entry['id'] ?? 'token-' . $index),
                    'token' => (string) $entry['token'],
                ];
            }
            return $tokens;
        }

        return [['id' => 'default', 'label' => 'default', 'token' => $raw]];
    }
}
