<?php

namespace App\Services\Mcp\Tools;

use App\Http\Controllers\Api\MediaUploadController;
use App\Models\User;
use App\Services\Mcp\Tool;
use Illuminate\Http\Request;
use RuntimeException;

class ConfirmUploadTool implements Tool
{
    public function __construct(private MediaUploadController $controller)
    {
    }

    public function name(): string
    {
        return 'confirm_upload';
    }

    public function description(): string
    {
        return "Finalize a media upload after the file has been PUT to the signed URL returned by request_upload_url. Moves the temp file into the project's media library and returns the created media_id.";
    }

    public function inputSchema(): array
    {
        return [
            'type' => 'object',
            'properties' => [
                'upload_id' => ['type' => 'integer', 'description' => 'The upload_id returned by request_upload_url'],
            ],
            'required' => ['upload_id'],
            'additionalProperties' => false,
        ];
    }

    public function call(array $args, User $user): mixed
    {
        $id = (int) ($args['upload_id'] ?? 0);
        $request = Request::create("/api/media/uploads/{$id}/finalize", 'POST');
        $request->setUserResolver(fn () => $user);

        $response = $this->controller->finalize($request, $id);
        $data = $response->getData(true);
        if ($response->getStatusCode() >= 400) {
            throw new RuntimeException($data['message'] ?? 'Finalize failed');
        }
        return $data;
    }
}
