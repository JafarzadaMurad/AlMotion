<?php

namespace App\Providers;

use App\Services\Mcp\Tool;
use App\Services\Mcp\ToolRegistry;
use Illuminate\Support\ServiceProvider;

/**
 * Boots the MCP server's tool registry. Tools are concrete classes under
 * App\Services\Mcp\Tools — they get instantiated via the container so they
 * can typehint dependencies (controllers / services) in their constructor.
 *
 * To add a new tool, just create a class implementing App\Services\Mcp\Tool
 * and add its FQCN to TOOLS below. No other wiring needed.
 */
class McpServiceProvider extends ServiceProvider
{
    /**
     * @var class-string<Tool>[]
     */
    private const TOOLS = [
        // Read / identity
        \App\Services\Mcp\Tools\WhoamiTool::class,
        \App\Services\Mcp\Tools\ListPlansTool::class,
        \App\Services\Mcp\Tools\ListProjectsTool::class,
        \App\Services\Mcp\Tools\GetProjectTool::class,
        \App\Services\Mcp\Tools\ListMediaTool::class,
        \App\Services\Mcp\Tools\GetTranscriptTool::class,

        // AI generations (long-running, paired with status tools)
        \App\Services\Mcp\Tools\TranscribeMediaTool::class,
        \App\Services\Mcp\Tools\CheckTranscribeStatusTool::class,
        \App\Services\Mcp\Tools\ListHeygenAvatarsTool::class,
        \App\Services\Mcp\Tools\ListHeygenVoicesTool::class,
        \App\Services\Mcp\Tools\GenerateAvatarVideoTool::class,
        \App\Services\Mcp\Tools\CheckAvatarVideoStatusTool::class,
        \App\Services\Mcp\Tools\GenerateBrollTool::class,
        \App\Services\Mcp\Tools\CheckBrollStatusTool::class,
        \App\Services\Mcp\Tools\ChatWithAiTool::class,

        // Media import / upload
        \App\Services\Mcp\Tools\ImportVideoFromUrlTool::class,
        \App\Services\Mcp\Tools\CheckImportStatusTool::class,
        \App\Services\Mcp\Tools\RequestUploadUrlTool::class,
        \App\Services\Mcp\Tools\ConfirmUploadTool::class,
    ];

    public function register(): void
    {
        $this->app->singleton(ToolRegistry::class, function ($app) {
            $registry = new ToolRegistry();
            foreach (self::TOOLS as $class) {
                $registry->register($app->make($class));
            }
            return $registry;
        });
    }
}
