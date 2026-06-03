<?php

namespace App\Services\Mcp\Tools;

use App\Models\Project;
use App\Models\User;
use App\Services\Mcp\Tool;
use RuntimeException;

class ListMediaTool implements Tool
{
    public function name(): string
    {
        return 'list_media';
    }

    public function description(): string
    {
        return 'List all media files (videos, audio, images) in a given AlMotion project. Returns id, name, type, mime, size, duration, dimensions. Use this to find media_ids before transcribe_media or other media-targeting tools.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'project_id' => ['type' => 'integer', 'description' => 'Project id from list_projects'],
            ],
            'required' => ['project_id'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $project = Project::where('user_id', $user->id)->find($args['project_id'] ?? null);
        if (!$project) {
            throw new RuntimeException('Project not found');
        }
        return $project->mediaFiles()
            ->latest()
            ->get(['id', 'name', 'type', 'mime_type', 'size', 'duration', 'width', 'height', 'path', 'created_at'])
            ->toArray();
    }
}
