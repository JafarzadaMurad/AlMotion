<?php

namespace App\Services\Mcp\Tools;

use App\Models\Project;
use App\Models\Setting;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class TranscribeMediaTool implements Tool
{
    public function name(): string
    {
        return 'transcribe_media';
    }

    public function description(): string
    {
        return 'Start transcription of a media file (json2video Whisper proxy). Returns { job_id } immediately. Poll check_transcribe_status with that job_id every ~5 seconds until status="done" — at that point the result includes srt_url and segments.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'project_id' => ['type' => 'integer'],
                'media_id' => ['type' => 'integer', 'description' => 'MediaFile id from list_media'],
                'language' => ['type' => 'string', 'description' => 'Optional ISO language hint (e.g. "az", "en")'],
            ],
            'required' => ['project_id', 'media_id'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $project = Project::where('user_id', $user->id)->find($args['project_id'] ?? null);
        if (!$project) {
            throw new RuntimeException('Project not found');
        }
        $media = $project->mediaFiles()->find($args['media_id'] ?? null);
        if (!$media) {
            throw new RuntimeException('Media file not found in this project');
        }

        $absolute = Storage::disk('public')->path($media->path);
        if (!is_file($absolute)) {
            throw new RuntimeException('Media file is missing on disk');
        }

        $key = Setting::get('json2video_api_key') ?: config('services.json2video.key');
        if (empty($key)) {
            throw new RuntimeException('json2video API key not configured (admin must set it).');
        }
        $base = rtrim(config('services.json2video.base_url'), '/');

        $http = Http::timeout(300)
            ->withHeaders(['X-API-Key' => $key])
            ->attach('file', file_get_contents($absolute), basename($absolute));
        if (!empty($args['language'])) {
            $http = $http->attach('language', $args['language'], null, ['Content-Type' => 'text/plain']);
        }
        $resp = $http->post($base . '/api/v1/transcribe');
        $data = $resp->json();

        if (!$resp->successful()) {
            throw new RuntimeException('json2video rejected the request: ' . json_encode($data));
        }
        return [
            'job_id' => $data['job_id'] ?? null,
            'status' => $data['status'] ?? 'queued',
            'poll_with' => 'check_transcribe_status',
            'poll_interval_seconds' => 5,
        ];
    }
}
