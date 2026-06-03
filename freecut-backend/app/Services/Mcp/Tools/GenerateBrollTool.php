<?php

namespace App\Services\Mcp\Tools;

use App\Models\Setting;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GenerateBrollTool implements Tool
{
    public function name(): string
    {
        return 'generate_broll';
    }

    public function description(): string
    {
        return 'Generate an AI B-roll video clip from a text prompt (WaveSpeed / Bytedance Seedance). 2-12 seconds. Returns { request_id }. Poll check_broll_status every ~5 seconds until completed — then video URL is available. Requires plan.can_generate_broll=true.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'prompt' => ['type' => 'string', 'maxLength' => 2000],
                'duration' => ['type' => 'integer', 'minimum' => 2, 'maximum' => 12, 'default' => 5],
                'resolution' => ['type' => 'string', 'enum' => ['480p', '720p', '1080p'], 'default' => '480p'],
                'aspect_ratio' => ['type' => 'string', 'enum' => ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'], 'default' => '16:9'],
            ],
            'required' => ['prompt'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $plan = $user->plan;
        if (!$plan || !$plan->can_generate_broll) {
            throw new RuntimeException('Your plan does not include AI B-roll generation.');
        }
        $key = Setting::get('wavespeed_api_key');
        if (empty($key)) {
            throw new RuntimeException('WaveSpeed API key not configured. Contact admin.');
        }
        $body = [
            'prompt' => $args['prompt'],
            'resolution' => $args['resolution'] ?? '480p',
            'duration' => $args['duration'] ?? 5,
            'aspect_ratio' => $args['aspect_ratio'] ?? '16:9',
            'seed' => -1,
        ];
        $resp = Http::timeout(30)
            ->withHeaders(['Authorization' => 'Bearer ' . $key, 'Content-Type' => 'application/json'])
            ->post('https://api.wavespeed.ai/api/v3/bytedance/seedance-v1-pro-fast/text-to-video', $body);

        $data = $resp->json();
        if (!$resp->successful()) {
            throw new RuntimeException('WaveSpeed rejected the request: ' . json_encode($data));
        }
        return [
            'request_id' => $data['data']['id'] ?? null,
            'poll_with' => 'check_broll_status',
            'poll_interval_seconds' => 5,
        ];
    }
}
