<?php

namespace App\Services\Mcp\Tools;

use App\Models\MediaFile;
use App\Models\User;
use App\Services\Mcp\Tool;
use RuntimeException;

class CheckImportStatusTool implements Tool
{
    public function name(): string
    {
        return 'check_import_status';
    }

    public function description(): string
    {
        return "Look up the status of a previously imported media file by its media_id. MVP: imports complete synchronously inside import_video_from_url, so this tool just confirms the file exists. When async imports land later, this will report progress.";
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'media_id' => ['type' => 'integer'],
            ],
            'required' => ['media_id'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $media = MediaFile::where('user_id', $user->id)->find($args['media_id'] ?? null);
        if (!$media) {
            throw new RuntimeException('Media not found');
        }
        return [
            'status' => 'completed',
            'media' => $media->toArray(),
        ];
    }
}
