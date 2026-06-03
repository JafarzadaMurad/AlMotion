<?php

namespace App\Services\Mcp\Tools;

use App\Models\Setting;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Support\Facades\Http;
use RuntimeException;

class CheckTranscribeStatusTool implements Tool
{
    public function name(): string
    {
        return 'check_transcribe_status';
    }

    public function description(): string
    {
        return 'Poll the status of a transcription job started by transcribe_media. Status values: queued | processing | done | failed. When done, srt_url is included — fetch its body to get the actual SRT text.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => ['job_id' => ['type' => 'string']],
            'required' => ['job_id'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $key = Setting::get('json2video_api_key') ?: config('services.json2video.key');
        if (empty($key)) {
            throw new RuntimeException('json2video API key not configured.');
        }
        $base = rtrim(config('services.json2video.base_url'), '/');
        $jobId = $args['job_id'] ?? '';

        $resp = Http::timeout(30)
            ->withHeaders(['X-API-Key' => $key])
            ->get("{$base}/api/v1/transcribe/{$jobId}");

        return $resp->json();
    }
}
