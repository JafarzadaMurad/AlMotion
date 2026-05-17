<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class SettingsController extends Controller
{
    public function index()
    {
        $settings = Setting::all()->pluck('value', 'key');

        $openaiKey = $settings['openai_api_key'] ?? null;
        $pexelsKey = $settings['pexels_api_key'] ?? null;
        $wavespeedKey = $settings['wavespeed_api_key'] ?? null;
        $json2videoKey = $settings['json2video_api_key'] ?? null;
        $anthropicKey = $settings['anthropic_api_key'] ?? null;
        $userKeyModels = $settings['user_key_allowed_models'] ?? null;

        $aiSystemPrompt = $settings['ai_system_prompt'] ?? null;
        $aiRules = $settings['ai_rules'] ?? null;

        return response()->json([
            'openai_api_key' => $openaiKey ? $this->maskKey($openaiKey) : null,
            'openai_api_key_set' => !empty($openaiKey),
            'pexels_api_key' => $pexelsKey ? $this->maskKey($pexelsKey) : null,
            'pexels_api_key_set' => !empty($pexelsKey),
            'allow_user_api_keys' => filter_var($settings['allow_user_api_keys'] ?? 'true', FILTER_VALIDATE_BOOLEAN),
            'user_key_allowed_models' => $userKeyModels ? json_decode($userKeyModels, true) : null,
            'wavespeed_api_key' => $wavespeedKey ? $this->maskKey($wavespeedKey) : null,
            'wavespeed_api_key_set' => !empty($wavespeedKey),
            'heygen_api_key' => ($heygenKey = $settings['heygen_api_key'] ?? null) ? $this->maskKey($heygenKey) : null,
            'heygen_api_key_set' => !empty($settings['heygen_api_key'] ?? null),
            'json2video_api_key' => $json2videoKey ? $this->maskKey($json2videoKey) : null,
            'json2video_api_key_set' => !empty($json2videoKey),
            'anthropic_api_key' => $anthropicKey ? $this->maskKey($anthropicKey) : null,
            'anthropic_api_key_set' => !empty($anthropicKey),
            'ai_system_prompt' => $aiSystemPrompt,
            'ai_rules' => $aiRules ? json_decode($aiRules, true) : [],
            'ai_tool_descriptions' => json_decode($settings['ai_tool_descriptions'] ?? '{}', true) ?? [],
        ]);
    }

    public function update(Request $request)
    {
        $validated = $request->validate([
            'openai_api_key' => 'nullable|string',
            'pexels_api_key' => 'nullable|string',
            'allow_user_api_keys' => 'nullable|boolean',
            'user_key_allowed_models' => 'nullable|array',
            'user_key_allowed_models.*' => 'string',
            'wavespeed_api_key' => 'nullable|string',
            'heygen_api_key' => 'nullable|string',
            'json2video_api_key' => 'nullable|string',
            'anthropic_api_key' => 'nullable|string',
            'ai_system_prompt' => 'nullable|string',
            'ai_rules' => 'nullable|array',
            'ai_rules.*' => 'string',
            'ai_tool_descriptions' => 'nullable|array',
        ]);

        if (array_key_exists('openai_api_key', $validated) && $validated['openai_api_key'] !== null) {
            Setting::set('openai_api_key', $validated['openai_api_key']);
        }

        if (array_key_exists('pexels_api_key', $validated) && $validated['pexels_api_key'] !== null) {
            Setting::set('pexels_api_key', $validated['pexels_api_key']);
        }

        if (array_key_exists('allow_user_api_keys', $validated)) {
            Setting::set('allow_user_api_keys', $validated['allow_user_api_keys'] ? 'true' : 'false');
        }

        if (array_key_exists('user_key_allowed_models', $validated)) {
            Setting::set('user_key_allowed_models', json_encode($validated['user_key_allowed_models'] ?? []));
        }

        if (array_key_exists('wavespeed_api_key', $validated) && $validated['wavespeed_api_key'] !== null) {
            Setting::set('wavespeed_api_key', $validated['wavespeed_api_key']);
        }

        if (array_key_exists('heygen_api_key', $validated) && $validated['heygen_api_key'] !== null) {
            Setting::set('heygen_api_key', $validated['heygen_api_key']);
        }

        if (array_key_exists('json2video_api_key', $validated) && $validated['json2video_api_key'] !== null) {
            Setting::set('json2video_api_key', $validated['json2video_api_key']);
        }

        if (array_key_exists('anthropic_api_key', $validated) && $validated['anthropic_api_key'] !== null) {
            Setting::set('anthropic_api_key', $validated['anthropic_api_key']);
        }

        if (array_key_exists('ai_system_prompt', $validated)) {
            Setting::set('ai_system_prompt', $validated['ai_system_prompt'] ?? '');
        }

        if (array_key_exists('ai_rules', $validated)) {
            Setting::set('ai_rules', json_encode($validated['ai_rules'] ?? []));
        }

        if (array_key_exists('ai_tool_descriptions', $validated)) {
            Setting::set('ai_tool_descriptions', json_encode($validated['ai_tool_descriptions'] ?? []));
        }

        return response()->json(['message' => 'Settings updated']);
    }

    private function maskKey(string $key): string
    {
        if (strlen($key) <= 8) return '****';
        return substr($key, 0, 4) . '...' . substr($key, -4);
    }
}
