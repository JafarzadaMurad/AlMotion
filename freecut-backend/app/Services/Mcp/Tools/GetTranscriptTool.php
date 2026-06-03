<?php

namespace App\Services\Mcp\Tools;

use App\Models\Project;
use App\Models\Transcript;
use App\Models\User;
use App\Services\Mcp\Tool;
use RuntimeException;

class GetTranscriptTool implements Tool
{
    public function name(): string
    {
        return 'get_transcript';
    }

    public function description(): string
    {
        return 'Fetch a previously generated transcript for a media file (SRT + segments + plain text). Returns null if no transcript exists — in that case call transcribe_media first.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'project_id' => ['type' => 'integer'],
                'media_id' => ['type' => ['string', 'integer'], 'description' => 'Either the numeric MediaFile id or the frontend uuid stored on transcripts.frontend_uuid'],
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

        $mediaId = (string) ($args['media_id'] ?? '');
        $transcript = Transcript::where('project_id', $project->id)
            ->where('frontend_uuid', $mediaId)
            ->first();

        if ($transcript) {
            return [
                'source' => 'transcripts_table',
                'language' => $transcript->language,
                'text' => $transcript->text,
                'segments' => $transcript->segments,
            ];
        }

        $media = $project->mediaFiles()->find(is_numeric($mediaId) ? (int) $mediaId : null);
        if ($media && $media->transcript_data) {
            return [
                'source' => 'media_file.transcript_data',
                'transcript' => $media->transcript_data,
            ];
        }

        return ['transcript' => null, 'message' => 'No transcript found. Call transcribe_media to generate one.'];
    }
}
