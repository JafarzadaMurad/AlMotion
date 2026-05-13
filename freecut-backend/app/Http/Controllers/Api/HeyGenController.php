<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class HeyGenController extends Controller
{
    // --- Avatar Endpoints ---

    public function listAvatars(Request $request)
    {
        $user = $request->user();
        $this->checkHeygenAccess($user);
        $apiKey = $this->resolveApiKey($user);

        // Use v2 avatars endpoint — returns avatar_id that works directly with v2/video/generate
        $response = Http::timeout(30)
            ->withHeaders(['x-api-key' => $apiKey, 'accept' => 'application/json'])
            ->get('https://api.heygen.com/v2/avatars');

        $data = $response->json();

        // User has own key — all avatars (public + custom) are shown

        return response()->json($data, $response->status());
    }

    public function listAvatarLooks(Request $request)
    {
        $user = $request->user();
        $this->checkHeygenAccess($user);
        $apiKey = $this->resolveApiKey($user);

        $response = Http::timeout(30)
            ->withHeaders(['x-api-key' => $apiKey])
            ->get('https://api.heygen.com/v3/avatars/looks', array_filter([
                'ownership' => $request->query('ownership'),
                'avatar_type' => $request->query('avatar_type'),
                'group_id' => $request->query('group_id'),
                'limit' => $request->query('limit', 50),
                'token' => $request->query('token'),
            ]));

        $data = $response->json();

        // Filter: only return looks that have supported_api_engines (can create video via API)
        if (isset($data['data']) && is_array($data['data'])) {
            $data['data'] = array_values(array_filter($data['data'], function ($look) {
                $engines = $look['supported_api_engines'] ?? [];
                // Keep looks that have any engine support (avatar_4_quality, avatar_4_turbo, avatar_v, etc.)
                return !empty($engines);
            }));
        }

        return response()->json($data, $response->status());
    }

    // --- Voice Endpoints ---

    public function listVoices(Request $request)
    {
        $user = $request->user();
        $this->checkHeygenAccess($user);
        $apiKey = $this->resolveApiKey($user);

        // Use v2 voices — has name + preview_audio fields
        $response = Http::timeout(30)
            ->withHeaders(['x-api-key' => $apiKey, 'accept' => 'application/json'])
            ->get('https://api.heygen.com/v2/voices');

        return response()->json($response->json(), $response->status());
    }

    // --- Avatar Creation ---

    public function createAvatar(Request $request)
    {
        $user = $request->user();
        $this->checkHeygenAccess($user);
        $plan = $user->plan;

        if (!$plan || !$plan->can_create_avatars) {
            return response()->json(['error' => 'Your plan does not allow creating avatars.'], 403);
        }

        $apiKey = $this->resolveApiKey($user);

        // Upload photo and create talking photo avatar
        $request->validate(['file' => 'required|file|image|max:10240']);
        $file = $request->file('file');

        $response = Http::timeout(60)
            ->withHeaders(['x-api-key' => $apiKey])
            ->attach('file', file_get_contents($file->getRealPath()), $file->getClientOriginalName())
            ->post('https://api.heygen.com/v2/photo_avatar');

        $data = $response->json();

        if ($response->successful() && isset($data['data'])) {
            $avatarData = $data['data'];
            $user->userAvatars()->create([
                'heygen_avatar_id' => $avatarData['avatar_id'] ?? $avatarData['id'] ?? '',
                'heygen_group_id' => null,
                'name' => $request->input('name', 'My Avatar'),
                'preview_url' => $avatarData['preview_url'] ?? null,
                'type' => 'photo',
            ]);
        }

        return response()->json($data, $response->status());
    }

    // --- Video Generation ---

    public function createVideo(Request $request)
    {
        $user = $request->user();
        $this->checkHeygenAccess($user);
        $this->checkCreditLimit($user);
        $apiKey = $this->resolveApiKey($user);

        // Use v2 API — more compatible with all avatar types
        $avatarId = $request->input('avatar_id');
        $script = $request->input('script');
        $voiceId = $request->input('voice_id');
        $aspectRatio = $request->input('aspect_ratio', '9:16');

        // Determine dimensions from aspect ratio
        $width = 1080;
        $height = 1920;
        if ($aspectRatio === '16:9') { $width = 1920; $height = 1080; }
        elseif ($aspectRatio === '1:1') { $width = 1080; $height = 1080; }

        $voiceInput = ['type' => 'text', 'input_text' => $script];
        if ($voiceId) $voiceInput['voice_id'] = $voiceId;

        $payload = [
            'video_inputs' => [[
                'character' => [
                    'type' => 'avatar',
                    'avatar_id' => $avatarId,
                    'avatar_style' => 'normal',
                ],
                'voice' => $voiceInput,
            ]],
            'dimension' => ['width' => $width, 'height' => $height],
            'caption' => true,
        ];

        $response = Http::timeout(30)
            ->withHeaders(['x-api-key' => $apiKey, 'Content-Type' => 'application/json'])
            ->post('https://api.heygen.com/v2/video/generate', $payload);

        return response()->json($response->json(), $response->status());
    }

    public function getVideo(Request $request, string $videoId)
    {
        $user = $request->user();
        $apiKey = $this->resolveApiKey($user);

        // Use v1 status endpoint — more reliable
        $response = Http::timeout(15)
            ->withHeaders(['x-api-key' => $apiKey, 'accept' => 'application/json'])
            ->get('https://api.heygen.com/v1/video_status.get', ['video_id' => $videoId]);

        $data = $response->json();

        // Track credit when completed
        if ($response->successful() && ($data['data']['status'] ?? '') === 'completed') {
            $duration = $data['data']['duration'] ?? 0;
            $user->increment('heygen_credits_used_this_month', max(1, (int) ceil($duration)));
        }

        return response()->json($data, $response->status());
    }

    // --- Image Proxy (bypass COEP) ---

    public function proxyImage(Request $request)
    {
        $url = $request->query('url');
        if (!$url || (!str_contains($url, 'heygen') && !str_contains($url, 'files2.heygen'))) {
            return response()->json(['error' => 'Invalid URL'], 400);
        }

        try {
            $response = Http::timeout(15)
                ->withHeaders(['User-Agent' => 'Mozilla/5.0'])
                ->get($url);

            if (!$response->successful()) {
                return response()->json(['error' => 'Upstream error: ' . $response->status()], 502);
            }

            return response($response->body(), 200)
                ->header('Content-Type', $response->header('Content-Type') ?? 'image/webp')
                ->header('Cache-Control', 'public, max-age=86400')
                ->header('Access-Control-Allow-Origin', '*')
                ->header('Cross-Origin-Resource-Policy', 'cross-origin');
        } catch (\Exception $e) {
            return response()->json(['error' => 'Proxy error: ' . $e->getMessage()], 502);
        }
    }

    // --- Config ---

    public function config(Request $request)
    {
        $user = $request->user();
        $plan = $user->plan;

        return response()->json([
            'can_use_heygen' => $plan ? (bool) $plan->can_use_heygen : false,
            'can_create_avatars' => $plan ? (bool) $plan->can_create_avatars : false,
            'can_use_own_key' => $plan ? (bool) $plan->can_use_own_heygen_key : false,
            'has_own_key' => !empty($user->own_heygen_api_key),
            'has_key' => !empty($user->own_heygen_api_key),
            'credits_used' => $user->heygen_credits_used_this_month,
            'credits_limit' => $plan ? $plan->max_heygen_credits_monthly : 0,
        ]);
    }

    // --- Helpers ---

    private function resolveApiKey($user): string
    {
        if (!empty($user->own_heygen_api_key)) {
            return $user->own_heygen_api_key;
        }
        abort(500, 'HeyGen API key is not connected. Please add your HeyGen API key in Settings.');
    }

    private function checkHeygenAccess($user): void
    {
        $plan = $user->plan;
        if (!$plan || !$plan->can_use_heygen) {
            abort(403, 'Your plan does not include HeyGen features.');
        }
        if (empty($user->own_heygen_api_key)) {
            abort(403, 'Please connect your HeyGen API key in Settings to use avatar features.');
        }
    }

    private function checkCreditLimit($user): void
    {
        $plan = $user->plan;
        $limit = $plan ? $plan->max_heygen_credits_monthly : 0;
        if ($user->heygen_credits_used_this_month >= $limit) {
            abort(429, 'HeyGen credit limit reached for this month.');
        }
    }
}
