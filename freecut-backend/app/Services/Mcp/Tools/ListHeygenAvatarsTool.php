<?php

namespace App\Services\Mcp\Tools;

use App\Models\Setting;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class ListHeygenAvatarsTool implements Tool
{
    public function name(): string
    {
        return 'list_heygen_avatars';
    }

    public function description(): string
    {
        return 'List HeyGen avatars available to the user (public + their custom ones). Returns avatar_id values usable with generate_avatar_video. Requires the plan to have can_use_heygen=true and a HeyGen API key configured.';
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
            throw new RuntimeException('No HeyGen API key set. Add one in /settings or have admin configure it.');
        }
        $resp = Http::timeout(30)
            ->withHeaders(['x-api-key' => $key, 'accept' => 'application/json'])
            ->get('https://api.heygen.com/v2/avatars');
        return $resp->json();
    }
}
