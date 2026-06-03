<?php

namespace App\Services\Mcp\Tools;

use App\Models\User;
use App\Services\Mcp\Tool;

class ListProjectsTool implements Tool
{
    public function name(): string
    {
        return 'list_projects';
    }

    public function description(): string
    {
        return "List the user's AlMotion projects with their id, name, dimensions, fps, and media count. Returns the most recently updated first. Always call this before tools that need a project_id so the model uses real IDs.";
    }

    public function inputSchema(): array
    {
        return ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => false];
    }

    public function call(array $args, User $user): mixed
    {
        return $user->projects()
            ->withCount('mediaFiles')
            ->latest()
            ->get(['id', 'name', 'description', 'width', 'height', 'fps', 'background_color', 'created_at', 'updated_at'])
            ->toArray();
    }
}
