<?php

namespace App\Services\Mcp\Tools;

use App\Http\Controllers\Api\MediaUploadController;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Http\Request;
use RuntimeException;

class RequestUploadUrlTool implements Tool
{
    public function __construct(private MediaUploadController $controller)
    {
    }

    public function name(): string
    {
        return 'request_upload_url';
    }

    public function description(): string
    {
        return "Mint a single-use signed URL the caller can PUT a local file to. Designed for Claude Code / Cursor where the agent has shell access — run the curl_hint we return, then call confirm_upload with the upload_id once the PUT completes. Token expires in 1 hour. Max 500MB.";
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'project_id' => ['type' => 'integer', 'description' => 'Target project from list_projects'],
                'filename' => ['type' => 'string', 'description' => 'Filename to store as'],
                'size_bytes' => ['type' => 'integer', 'description' => 'Size of the file in bytes'],
                'content_type' => ['type' => 'string', 'description' => 'MIME type, e.g. video/mp4'],
            ],
            'required' => ['project_id', 'filename', 'size_bytes'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $request = Request::create('/api/media/uploads', 'POST', $args);
        $request->setUserResolver(fn () => $user);

        $response = $this->controller->createUploadSession($request);
        $data = $response->getData(true);
        if ($response->getStatusCode() >= 400) {
            throw new RuntimeException($data['message'] ?? 'Upload session creation failed');
        }
        return $data;
    }
}
