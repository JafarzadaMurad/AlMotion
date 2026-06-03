<?php

namespace App\Services\Mcp\Tools;

use App\Http\Controllers\Api\MediaImportController;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Http\Request;
use RuntimeException;

class ImportVideoFromUrlTool implements Tool
{
    public function __construct(private MediaImportController $controller)
    {
    }

    public function name(): string
    {
        return 'import_video_from_url';
    }

    public function description(): string
    {
        return 'Import a video into an AlMotion project from a public URL. Accepts direct file URLs (S3, Drive share links, generic HTTPS) and any yt-dlp-supported site (YouTube, TikTok, Instagram, Twitter/X, Vimeo, etc.). Returns the new media row synchronously when the download is fast; for long downloads the call may take up to 5 minutes. Plan storage limits apply.';
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'project_id' => ['type' => 'integer', 'description' => 'Target project from list_projects'],
                'url' => ['type' => 'string', 'description' => 'Public URL of the video'],
                'filename' => ['type' => 'string', 'description' => 'Optional override for the stored filename'],
                'type' => ['type' => 'string', 'enum' => ['video', 'audio', 'image'], 'default' => 'video'],
            ],
            'required' => ['project_id', 'url'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $request = Request::create('/api/media/import-from-url', 'POST', $args);
        $request->setUserResolver(fn () => $user);

        $response = $this->controller->importFromUrl($request);
        $data = $response->getData(true);

        if ($response->getStatusCode() >= 400) {
            throw new RuntimeException($data['message'] ?? 'Import failed');
        }
        return $data;
    }
}
