<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;

class UserSettingsController extends Controller
{
    /**
     * Get current user's API key settings and whether they can use own keys.
     */
    public function show(Request $request)
    {
        $user = $request->user();
        $canUseOwnKey = $this->canUserUseOwnKey($user);

        $plan = $user->plan;
        $canUseOwnHeygenKey = $plan && $plan->can_use_own_heygen_key;

        return response()->json([
            'can_use_own_api_key' => $canUseOwnKey,
            'has_own_openai_api_key' => !empty($user->own_openai_api_key),
            'own_openai_api_key_masked' => $user->own_openai_api_key
                ? $this->maskKey($user->own_openai_api_key)
                : null,
            'using_own_key' => $canUseOwnKey && !empty($user->own_openai_api_key),
            'can_use_own_heygen_key' => $canUseOwnHeygenKey,
            'has_own_heygen_api_key' => !empty($user->own_heygen_api_key),
            'own_heygen_api_key_masked' => $user->own_heygen_api_key
                ? $this->maskKey($user->own_heygen_api_key)
                : null,
        ]);
    }

    /**
     * Update user's own API key.
     */
    public function update(Request $request)
    {
        $user = $request->user();

        if (!$this->canUserUseOwnKey($user)) {
            return response()->json([
                'message' => 'Your plan does not allow using your own API key.',
            ], 403);
        }

        $validated = $request->validate([
            'own_openai_api_key' => 'nullable|string',
            'own_heygen_api_key' => 'nullable|string',
        ]);

        $updates = [];
        if (array_key_exists('own_openai_api_key', $validated)) {
            $updates['own_openai_api_key'] = $validated['own_openai_api_key'];
        }
        if (array_key_exists('own_heygen_api_key', $validated)) {
            $updates['own_heygen_api_key'] = $validated['own_heygen_api_key'];
        }

        $user->update($updates);

        return response()->json([
            'message' => 'Settings updated',
            'has_own_openai_api_key' => !empty($user->own_openai_api_key),
            'has_own_heygen_api_key' => !empty($user->own_heygen_api_key),
        ]);
    }

    private function canUserUseOwnKey($user): bool
    {
        // User-level override takes priority (null = inherit from plan)
        if ($user->can_use_own_api_key !== null) {
            return (bool) $user->can_use_own_api_key;
        }

        // Check global setting
        $globalAllow = filter_var(Setting::get('allow_user_api_keys', 'true'), FILTER_VALIDATE_BOOLEAN);
        if (!$globalAllow) {
            return false;
        }

        // Check plan-level permission
        $plan = $user->plan;
        if ($plan) {
            return (bool) $plan->can_use_own_api_key;
        }

        return false;
    }

    private function maskKey(string $key): string
    {
        if (strlen($key) <= 8) return '****';
        return substr($key, 0, 4) . '...' . substr($key, -4);
    }
}
