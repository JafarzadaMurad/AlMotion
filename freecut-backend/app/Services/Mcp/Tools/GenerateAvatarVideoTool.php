<?php

namespace App\Services\Mcp\Tools;

use App\Models\Setting;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class GenerateAvatarVideoTool implements Tool
{
    public function name(): string
    {
        return 'generate_avatar_video';
    }

    public function description(): string
    {
        return 'Kick off a HeyGen avatar video generation. Returns { video_id } immediately. Poll check_avatar_video_status every ~10 seconds until status="completed" — then video_url is available. Counts against the plan\'s HeyGen credit limit.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'avatar_id' => ['type' => 'string', 'description' => 'From list_heygen_avatars'],
                'voice_id' => ['type' => 'string', 'description' => 'From list_heygen_voices'],
                'script' => ['type' => 'string', 'description' => 'Text the avatar will read'],
                'aspect_ratio' => ['type' => 'string', 'enum' => ['16:9', '9:16', '1:1'], 'default' => '16:9'],
            ],
            'required' => ['avatar_id', 'voice_id', 'script'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $plan = $user->plan;
        if (!$plan || !$plan->can_use_heygen) {
            throw new RuntimeException('Your plan does not include HeyGen access.');
        }
        $key = $user->own_heygen_api_key ?: Setting::get('heygen_api_key');
        if (empty($key)) {
            throw new RuntimeException('No HeyGen API key set.');
        }

        $aspect = $args['aspect_ratio'] ?? '16:9';
        $dimensions = match ($aspect) {
            '9:16' => ['width' => 720, 'height' => 1280],
            '1:1' => ['width' => 1080, 'height' => 1080],
            default => ['width' => 1280, 'height' => 720],
        };

        $body = [
            'video_inputs' => [[
                'character' => ['type' => 'avatar', 'avatar_id' => $args['avatar_id']],
                'voice' => ['type' => 'text', 'input_text' => $args['script'], 'voice_id' => $args['voice_id']],
            ]],
            'dimension' => $dimensions,
        ];

        $resp = Http::timeout(60)
            ->withHeaders(['x-api-key' => $key, 'content-type' => 'application/json'])
            ->post('https://api.heygen.com/v2/video/generate', $body);

        $data = $resp->json();
        if (!$resp->successful()) {
            throw new RuntimeException('HeyGen rejected the request: ' . json_encode($data));
        }
        return [
            'video_id' => $data['data']['video_id'] ?? null,
            'poll_with' => 'check_avatar_video_status',
            'poll_interval_seconds' => 10,
        ];
    }
}
