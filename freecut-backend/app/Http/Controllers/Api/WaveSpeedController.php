<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Setting;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class WaveSpeedController extends Controller
{
    private const API_BASE = 'https://api.wavespeed.ai/api/v3';

    public function generate(Request $request)
    {
        $user = $request->user();

        // Check if user's plan allows broll generation
        $plan = $user->plan;
        if (!$plan || !$plan->can_generate_broll) {
            return response()->json([
                'error' => 'Your plan does not include AI B-Roll generation. Please upgrade.',
            ], 403);
        }

        $apiKey = Setting::get('wavespeed_api_key');
        if (!$apiKey) {
            return response()->json(['error' => 'WaveSpeed API key is not configured. Contact admin.'], 500);
        }

        $validated = $request->validate([
            'prompt' => 'required|string|max:2000',
            'resolution' => 'string|in:480p,720p,1080p',
            'duration' => 'integer|min:2|max:12',
            'aspect_ratio' => 'string|in:21:9,16:9,4:3,1:1,3:4,9:16',
            'seed' => 'integer|min:-1',
        ]);

        $body = [
            'prompt' => $validated['prompt'],
            'resolution' => $validated['resolution'] ?? '480p',
            'duration' => $validated['duration'] ?? 5,
            'aspect_ratio' => $validated['aspect_ratio'] ?? '16:9',
            'seed' => $validated['seed'] ?? -1,
        ];

        try {
            $response = Http::timeout(30)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                    'Content-Type' => 'application/json',
                ])
                ->post(self::API_BASE . '/bytedance/seedance-v1-pro-fast/text-to-video', $body);

            return response()->json($response->json(), $response->status());
        } catch (\Exception $e) {
            return response()->json(['error' => 'WaveSpeed API failed: ' . $e->getMessage()], 502);
        }
    }

    public function status(string $requestId)
    {
        $apiKey = Setting::get('wavespeed_api_key');
        if (!$apiKey) {
            return response()->json(['error' => 'WaveSpeed API key not configured.'], 500);
        }

        try {
            $response = Http::timeout(15)
                ->withHeaders([
                    'Authorization' => 'Bearer ' . $apiKey,
                ])
                ->get(self::API_BASE . '/predictions/' . $requestId . '/result');

            return response()->json($response->json(), $response->status());
        } catch (\Exception $e) {
            return response()->json(['error' => 'Failed to check status: ' . $e->getMessage()], 502);
        }
    }

    public function config(Request $request)
    {
        $user = $request->user();
        $plan = $user->plan;

        return response()->json([
            'can_generate_broll' => $plan ? (bool) $plan->can_generate_broll : false,
            'wavespeed_configured' => !empty(Setting::get('wavespeed_api_key')),
        ]);
    }
}
