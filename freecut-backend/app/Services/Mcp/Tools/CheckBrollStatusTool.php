<?php

namespace App\Services\Mcp\Tools;

use App\Models\Setting;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class CheckBrollStatusTool implements Tool
{
    public function name(): string
    {
        return 'check_broll_status';
    }

    public function description(): string
    {
        return 'Poll a WaveSpeed B-roll generation job. status values: created | processing | completed | failed. When completed, outputs[] contains downloadable video URLs.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => ['request_id' => ['type' => 'string']],
            'required' => ['request_id'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $key = Setting::get('wavespeed_api_key');
        if (empty($key)) {
            throw new RuntimeException('WaveSpeed API key not configured.');
        }
        $id = $args['request_id'] ?? '';
        $resp = Http::timeout(15)
            ->withHeaders(['Authorization' => 'Bearer ' . $key])
            ->get('https://api.wavespeed.ai/api/v3/predictions/' . $id . '/result');
        return $resp->json();
    }
}
