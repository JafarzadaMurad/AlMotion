<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\TokenUsage;
use App\Services\Ai\AiProvider;
use App\Services\Ai\ProviderRegistry;
use App\Services\Billing\AiPricingService;
use App\Services\Billing\CreditLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class OpenAiController extends Controller
{
    public function __construct(
        private ProviderRegistry $providers,
        private AiPricingService $pricing,
        private CreditLedger $credits,
    ) {
    }

    private const DEFAULT_PLAN_MODELS = ['gpt-4o-mini'];

    /**
     * Where a subscription turn lands when the pool is exhausted. Sonnet
     * rather than Opus: the fallback exists to keep the editor working, and
     * silently upgrading a user to the most expensive model on a bad day is
     * not a bill anyone agreed to.
     */
    private const SUBSCRIPTION_FALLBACK_MODEL = 'claude-sonnet-5';

    public function proxy(Request $request)
    {
        $user = $request->user();
        $requestedModel = $request->json('model', 'gpt-4o-mini');

        $provider = $this->providers->forModel($requestedModel);
        if (!$provider) {
            return response()->json([
                'error' => "Unknown model '{$requestedModel}'. No registered provider handles it.",
            ], 400);
        }

        $apiKey = $this->resolveApiKey($user, $provider);
        if (!$apiKey) {
            return response()->json([
                'error' => "No {$provider->name()} API key configured. Contact admin or add your own key.",
            ], 500);
        }

        // Validate model against plan/key allowances
        $allowedModels = $this->getAllowedModels($user);
        if (!in_array($requestedModel, $allowedModels)) {
            return response()->json([
                'error' => "Model '{$requestedModel}' is not allowed for your plan. Allowed: " . implode(', ', $allowedModels),
            ], 403);
        }

        try {
            $rawBody = $request->getContent();
            $payload = $request->json()->all();
            $result = $provider->chat($rawBody, $payload, $apiKey);
        } catch (\Exception $e) {
            return response()->json(['error' => "Failed to reach {$provider->name()}: " . $e->getMessage()], 502);
        }

        // A subscription's rate limit is sized for one person's day of work, so
        // an exhausted pool is an expected state rather than an error. The
        // sidecar signals it with 503; fall back to the metered API key so the
        // user gets an answer. Running out costs money, never function.
        if ($result->status === 503 && $provider instanceof \App\Services\Ai\ClaudeSubscriptionProvider) {
            $fallback = $this->providers->byName('anthropic');
            $fallbackKey = $fallback ? $this->resolveApiKey($user, $fallback) : null;

            if ($fallback && $fallbackKey) {
                \Illuminate\Support\Facades\Log::info('Claude subscription unavailable, falling back to API key', [
                    'reason' => $result->data['error']['code'] ?? 'unknown',
                ]);
                $payload['model'] = self::SUBSCRIPTION_FALLBACK_MODEL;
                $provider = $fallback;
                $result = $fallback->chat(json_encode($payload), $payload, $fallbackKey);
            }
        }

        if ($result->successful()) {
            $usage = $result->usage();
            if ($usage['total_tokens'] > 0) {
                // Price against the model the user asked for, not the one that
                // answered: a subscription turn still has a market value, and
                // pricing it at zero would make the fallback look free.
                $priced = $this->pricing->priceUsage(
                    $provider->name() === 'claude_subscription' ? 'anthropic' : $provider->name(),
                    $requestedModel,
                    $usage + ['cached_tokens' => $result->data['usage']['cache_read_input_tokens'] ?? 0],
                );

                TokenUsage::create([
                    'user_id' => $user->id,
                    'provider' => $provider->name(),
                    'service' => $provider->name(),
                    'model' => $requestedModel,
                    'prompt_tokens' => $usage['prompt_tokens'],
                    'completion_tokens' => $usage['completion_tokens'],
                    'total_tokens' => $usage['total_tokens'],
                    'real_cost_usd' => $priced['real_cost_usd'],
                    'credits_charged' => $priced['credits'],
                    'endpoint' => 'chat/completions',
                ]);

                $user->increment($provider->userUsageColumn(), $usage['total_tokens']);
                $this->credits->charge($user, $priced['credits']);
            }
        }

        return response()->json($result->data, $result->status);
    }

    public function transcribeProxy(Request $request)
    {
        $request->validate([
            'file' => 'required|file|max:512000', // 500MB
        ]);

        $j2vKey = \App\Models\Setting::get('json2video_api_key') ?: config('services.json2video.key');
        if (empty($j2vKey)) {
            return response()->json(['error' => 'Transcription service is not configured. Admin must set the json2video API key.'], 500);
        }
        $j2vBase = rtrim(config('services.json2video.base_url'), '/');

        $file = $request->file('file');
        $language = $request->input('language');

        try {
            $http = Http::timeout(300)
                ->withHeaders(['X-API-Key' => $j2vKey])
                ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName());

            if ($language) {
                $http = $http->attach('language', $language, null, ['Content-Type' => 'text/plain']);
            }

            $response = $http->post($j2vBase . '/api/v1/transcribe');

            return response()->json($response->json(), $response->status());
        } catch (\Exception $e) {
            return response()->json(['error' => 'Transcription server failed: ' . $e->getMessage()], 502);
        }
    }

    public function transcribeStatus(string $jobId)
    {
        $j2vKey = \App\Models\Setting::get('json2video_api_key') ?: config('services.json2video.key');
        if (empty($j2vKey)) {
            return response()->json(['error' => 'Transcription service is not configured.'], 500);
        }
        $j2vBase = rtrim(config('services.json2video.base_url'), '/');

        try {
            $response = Http::timeout(30)
                ->withHeaders(['X-API-Key' => $j2vKey])
                ->get("{$j2vBase}/api/v1/transcribe/{$jobId}");

            return response()->json($response->json(), $response->status());
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 502);
        }
    }

    public function transcribeSrt(Request $request)
    {
        $srtUrl = $request->input('url');
        if (!$srtUrl) {
            return response()->json(['error' => 'url parameter required'], 400);
        }

        $j2vKey = \App\Models\Setting::get('json2video_api_key') ?: config('services.json2video.key');

        try {
            $http = Http::timeout(30);
            if (!empty($j2vKey)) {
                $http = $http->withHeaders(['X-API-Key' => $j2vKey]);
            }
            $response = $http->get($srtUrl);
            return response($response->body(), $response->status())
                ->header('Content-Type', 'text/plain');
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 502);
        }
    }

    public function transcribe(Request $request)
    {
        $user = $request->user();
        $openaiProvider = $this->providers->byName('openai');
        $openaiKey = $openaiProvider ? $this->resolveApiKey($user, $openaiProvider) : null;

        if (!$openaiKey) {
            return response()->json(['error' => 'No OpenAI API key configured.'], 500);
        }

        $request->validate([
            'file' => 'required|file|max:25600', // 25MB max for Whisper
        ]);

        $file = $request->file('file');

        try {
            $response = Http::timeout(300)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $openaiKey,
                ])
                ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName())
                ->post('https://api.openai.com/v1/audio/transcriptions', [
                    'model' => 'whisper-1',
                    'response_format' => 'verbose_json',
                    'timestamp_granularities[]' => 'segment',
                ]);
        } catch (\Exception $e) {
            return response()->json(['error' => 'Whisper API failed: ' . $e->getMessage()], 502);
        }

        $data = $response->json();

        if ($response->successful() && isset($data['segments'])) {
            $totalDuration = $data['duration'] ?? 0;
            $estimatedTokens = (int) ($totalDuration * 100); // rough estimate
            $user->increment('tokens_used_this_month', $estimatedTokens);
        }

        return response()->json($data, $response->status());
    }

    public function aiConfig(Request $request)
    {
        $user = $request->user();
        $usingOwnKey = $this->canUserUseOwnKey($user) && !empty($user->own_openai_api_key);

        $allowedModels = $this->getAllowedModels($user);
        $defaultModel = $allowedModels[0] ?? 'gpt-4o-mini';

        $pexelsKey = Setting::get('pexels_api_key') ?: env('PEXELS_API_KEY');

        $aiSystemPrompt = Setting::get('ai_system_prompt');
        $aiRulesJson = Setting::get('ai_rules');
        $aiRules = $aiRulesJson ? json_decode($aiRulesJson, true) : [];
        $aiToolDescsJson = Setting::get('ai_tool_descriptions');
        $aiToolDescs = $aiToolDescsJson ? json_decode($aiToolDescsJson, true) : [];

        return response()->json([
            'available_models' => $allowedModels,
            'default_model' => $defaultModel,
            'using_own_key' => $usingOwnKey,
            'pexels_api_key' => $pexelsKey,
            'ai_system_prompt' => $aiSystemPrompt,
            'ai_rules' => is_array($aiRules) ? $aiRules : [],
            'ai_tool_descriptions' => is_array($aiToolDescs) ? $aiToolDescs : [],
        ]);
    }

    private function getAllowedModels($user): array
    {
        $allKnownModels = $this->providers->allModels();
        $usingOwnKey = $this->canUserUseOwnKey($user) && !empty($user->own_openai_api_key);

        if ($usingOwnKey) {
            $modelsJson = Setting::get('user_key_allowed_models');
            if ($modelsJson) {
                $decoded = json_decode($modelsJson, true);
                return is_array($decoded) && count($decoded) > 0 ? $decoded : $allKnownModels;
            }
            return $allKnownModels;
        }

        // Platform key: use plan's allowed_models
        $plan = $user->plan;
        if ($plan && !empty($plan->allowed_models)) {
            return $plan->allowed_models;
        }

        return self::DEFAULT_PLAN_MODELS;
    }

    /**
     * Resolve which API key to use for the given provider:
     * 1. User's own OpenAI key (only OpenAI supports this today)
     * 2. Global key from admin settings (Setting key is provider-specific)
     * 3. .env fallback (env var is provider-specific)
     */
    private function resolveApiKey($user, AiProvider $provider): ?string
    {
        // Per-user own-key path is only wired up for OpenAI right now.
        if ($provider->name() === 'openai'
            && $this->canUserUseOwnKey($user)
            && !empty($user->own_openai_api_key)) {
            return $user->own_openai_api_key;
        }

        $globalKey = Setting::get($provider->apiKeySettingName());
        if (!empty($globalKey)) {
            return $globalKey;
        }

        return env($provider->apiKeyEnvVar());
    }

    private function canUserUseOwnKey($user): bool
    {
        // User-level override
        if ($user->can_use_own_api_key !== null) {
            return (bool) $user->can_use_own_api_key;
        }

        // Global setting
        $globalAllow = filter_var(Setting::get('allow_user_api_keys', 'true'), FILTER_VALIDATE_BOOLEAN);
        if (!$globalAllow) {
            return false;
        }

        // Plan-level
        $plan = $user->plan;
        if ($plan) {
            return (bool) $plan->can_use_own_api_key;
        }

        return false;
    }
}
