<?php

namespace App\Services\Mcp\Tools;

use App\Models\Project;
use App\Models\User;
use App\Services\Mcp\Tool;
use RuntimeException;

class GetProjectTool implements Tool
{
    public function name(): string
    {
        return 'get_project';
    }

    public function description(): string
    {
        return 'Fetch a single AlMotion project by id including its media library. By default the (potentially large) `timeline_data` JSON is omitted to keep responses small — pass include_timeline=true if you need it.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'project_id' => ['type' => 'integer', 'description' => 'Project id from list_projects'],
                'include_timeline' => ['type' => 'boolean', 'description' => 'Include the raw timeline_data JSON. Off by default.', 'default' => false],
            ],
            'required' => ['project_id'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $project = Project::where('user_id', $user->id)
            ->with('mediaFiles')
            ->find($args['project_id'] ?? null);
        if (!$project) {
            throw new RuntimeException('Project not found');
        }

        $data = $project->toArray();
        if (empty($args['include_timeline'])) {
            unset($data['timeline_data']);
            $data['timeline_data_omitted'] = true;
        }
        return $data;
    }
}
