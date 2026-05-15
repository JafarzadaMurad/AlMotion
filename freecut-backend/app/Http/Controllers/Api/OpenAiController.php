<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use App\Models\TokenUsage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class OpenAiController extends Controller
{
    // All models the platform recognizes
    private const ALL_MODELS = [
        'gpt-4.1',
        'gpt-4.1-mini',
        'gpt-4o',
        'gpt-4o-mini',
        'o4-mini',
        'o3-mini',
    ];

    private const DEFAULT_PLAN_MODELS = ['gpt-4o-mini'];

    public function proxy(Request $request)
    {
        $user = $request->user();
        $openaiKey = $this->resolveApiKey($user);

        if (!$openaiKey) {
            return response()->json(['error' => 'No OpenAI API key configured. Contact admin or add your own key.'], 500);
        }

        $requestedModel = $request->json('model', 'gpt-4o-mini');

        // Validate model against plan/key allowances
        $allowedModels = $this->getAllowedModels($user);
        if (!in_array($requestedModel, $allowedModels)) {
            return response()->json([
                'error' => "Model '{$requestedModel}' is not allowed for your plan. Allowed: " . implode(', ', $allowedModels),
            ], 403);
        }

        try {
            $response = Http::timeout(120)->withHeaders([
                'Authorization' => 'Bearer ' . $openaiKey,
                'Content-Type' => 'application/json'
            ])->withBody($request->getContent(), 'application/json')
                ->post('https://api.openai.com/v1/chat/completions');
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to reach OpenAI: ' . $e->getMessage()], 502);
        }

        $data = $response->json();

        if ($response->successful() && isset($data['usage'])) {
            $usage = $data['usage'];
            $totalTokens = $usage['total_tokens'] ?? 0;

            TokenUsage::create([
                'user_id' => $user->id,
                'service' => 'openai',
                'model' => $requestedModel,
                'prompt_tokens' => $usage['prompt_tokens'] ?? 0,
                'completion_tokens' => $usage['completion_tokens'] ?? 0,
                'total_tokens' => $totalTokens,
                'endpoint' => 'chat/completions'
            ]);

            $user->increment('tokens_used_this_month', $totalTokens);
        }

        return response()->json($data, $response->status());
    }

    public function transcribeProxy(Request $request)
    {
        $request->validate([
            'file' => 'required|file|max:512000', // 500MB
        ]);

        $j2vKey = config('services.json2video.key');
        if (empty($j2vKey)) {
            return response()->json(['error' => 'Transcription service is not configured (missing JSON2VIDEO_API_KEY).'], 500);
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
        $j2vKey = config('services.json2video.key');
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

        try {
            $response = Http::timeout(30)->get($srtUrl);
            return response($response->body(), $response->status())
                ->header('Content-Type', 'text/plain');
        } catch (\Exception $e) {
            return response()->json(['error' => $e->getMessage()], 502);
        }
    }

    public function transcribe(Request $request)
    {
        $user = $request->user();
        $openaiKey = $this->resolveApiKey($user);

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
        $usingOwnKey = $this->canUserUseOwnKey($user) && !empty($user->own_openai_api_key);

        if ($usingOwnKey) {
            $modelsJson = Setting::get('user_key_allowed_models');
            if ($modelsJson) {
                $decoded = json_decode($modelsJson, true);
                return is_array($decoded) && count($decoded) > 0 ? $decoded : self::ALL_MODELS;
            }
            return self::ALL_MODELS;
        }

        // Platform key: use plan's allowed_models
        $plan = $user->plan;
        if ($plan && !empty($plan->allowed_models)) {
            return $plan->allowed_models;
        }

        return self::DEFAULT_PLAN_MODELS;
    }

    /**
     * Resolve which API key to use:
     * 1. User's own key (if allowed and set)
     * 2. Global key from admin settings
     * 3. .env fallback
     */
    private function resolveApiKey($user): ?string
    {
        // Check if user can and has set their own key
        if ($this->canUserUseOwnKey($user) && !empty($user->own_openai_api_key)) {
            return $user->own_openai_api_key;
        }

        // Global key from admin settings
        $globalKey = Setting::get('openai_api_key');
        if (!empty($globalKey)) {
            return $globalKey;
        }

        // Fallback to .env
        return env('OPENAI_API_KEY');
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
