<?php

namespace App\Services\Mcp\Tools;

use App\Models\Setting;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class CheckAvatarVideoStatusTool implements Tool
{
    public function name(): string
    {
        return 'check_avatar_video_status';
    }

    public function description(): string
    {
        return 'Poll a HeyGen video generation job. status values: pending | processing | completed | failed. When completed the response includes video_url, thumbnail_url, duration.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => ['video_id' => ['type' => 'string']],
            'required' => ['video_id'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $key = $user->own_heygen_api_key ?: Setting::get('heygen_api_key');
        if (empty($key)) {
            throw new RuntimeException('No HeyGen API key set.');
        }
        $videoId = $args['video_id'] ?? '';
        $resp = Http::timeout(30)
            ->withHeaders(['x-api-key' => $key, 'accept' => 'application/json'])
            ->get('https://api.heygen.com/v1/video_status.get', ['video_id' => $videoId]);
        return $resp->json();
    }
}
