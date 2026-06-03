<?php

namespace App\Services\Mcp\Tools;

use App\Models\Setting;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class ListHeygenVoicesTool implements Tool
{
    public function name(): string
    {
        return 'list_heygen_voices';
    }

    public function description(): string
    {
        return 'List HeyGen voices the user can pick from (name + preview_audio + language). Returns voice_id values usable with generate_avatar_video.';
    }

    public function inputSchema(): array
    {
        return ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => false];
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
        $resp = Http::timeout(30)
            ->withHeaders(['x-api-key' => $key, 'accept' => 'application/json'])
            ->get('https://api.heygen.com/v2/voices');
        return $resp->json();
    }
}
