<?php

namespace App\Services\Mcp\Tools;

use App\Models\Setting;
use App\Models\TokenUsage;
use App\Models\User;
use App\Services\Ai\ProviderRegistry;
use App\Services\Mcp\Tool;
use App\Services\Plans\PlanGate;
use RuntimeException;

class ChatWithAiTool implements Tool
{
    public function __construct(
        private ProviderRegistry $providers,
        private PlanGate $gate,
    ) {
    }

    public function name(): string
    {
        return 'chat_with_ai';
    }

    public function description(): string
    {
        return "Send a chat completion request to AlMotion's AI proxy. Model auto-routes to OpenAI / Anthropic / Gemini based on the model name (e.g. 'gpt-4o-mini', 'claude-sonnet-4-6', 'gemini-3-flash'). Plan-level token quotas apply. Returns the assistant message; tool_calls are passed through if you send tools[].";
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'model' => ['type' => 'string', 'description' => 'A model id allowed by the user\'s plan. Call whoami / list_plans for available models.'],
                'messages' => ['type' => 'array', 'description' => 'OpenAI Chat Completions style messages: [{role, content}, ...].'],
                'system' => ['type' => 'string', 'description' => 'Optional system prompt prepended to messages.'],
                'temperature' => ['type' => 'number', 'minimum' => 0, 'maximum' => 2],
            ],
            'required' => ['model', 'messages'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $model = $args['model'];
        $provider = $this->providers->forModel($model);
        if (!$provider) {
            throw new RuntimeException("Unknown model: {$model}");
        }

        $this->gate->assertCanUseTokensFor($user, $model);

        $apiKey = $this->resolveKey($user, $provider);
        if (empty($apiKey)) {
            throw new RuntimeException("No API key configured for {$provider->name()}.");
        }

        $messages = $args['messages'];
        if (!empty($args['system'])) {
            array_unshift($messages, ['role' => 'system', 'content' => $args['system']]);
        }
        $payload = [
            'model' => $model,
            'messages' => $messages,
        ];
        if (isset($args['temperature'])) {
            $payload['temperature'] = $args['temperature'];
        }

        $raw = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $result = $provider->chat($raw, $payload, $apiKey);

        if ($result->successful()) {
            $usage = $result->usage();
            if ($usage['total_tokens'] > 0) {
                TokenUsage::create([
                    'user_id' => $user->id,
                    'provider' => $provider->name(),
                    'service' => $provider->name(),
                    'model' => $model,
                    'prompt_tokens' => $usage['prompt_tokens'],
                    'completion_tokens' => $usage['completion_tokens'],
                    'total_tokens' => $usage['total_tokens'],
                    'endpoint' => 'mcp/chat',
                ]);
                $user->increment($provider->userUsageColumn(), $usage['total_tokens']);
            }
        }

        return $result->data;
    }

    private function resolveKey(User $user, $provider): ?string
    {
        if ($provider->name() === 'openai' && !empty($user->own_openai_api_key)) {
            return $user->own_openai_api_key;
        }
        $global = Setting::get($provider->apiKeySettingName());
        if (!empty($global)) {
            return $global;
        }
        return env($provider->apiKeyEnvVar());
    }
}
