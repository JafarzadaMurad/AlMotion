<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\PlanLimitException;
use App\Http\Controllers\Controller;
use App\Models\Project;
use App\Services\Media\YtDlpDownloader;
use App\Services\Plans\PlanGate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Imports a video from a public URL (direct file URL or any yt-dlp-supported
 * site like YouTube / Instagram / TikTok) into a project's media library.
 *
 * The endpoint is synchronous for MVP — we download, save, and return the
 * MediaFile in one request. Caddy is configured for 500MB body / long
 * timeouts and yt-dlp itself caps at 300s, so for small clips this is
 * fine. A future job queue would let this be properly async.
 *
 * The corresponding MCP tools (import_video_from_url, check_import_status)
 * call into this controller; check_import_status is currently a no-op
 * since we don't have async yet — it just returns the already-finished
 * media row.
 */
class MediaImportController extends Controller
{
    public function __construct(
        private YtDlpDownloader $downloader,
        private PlanGate $gate,
    ) {
    }

    public function importFromUrl(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'url' => 'required|url|max:2000',
            'project_id' => 'required|integer|exists:projects,id',
            'filename' => 'nullable|string|max:255',
            'type' => 'nullable|in:video,audio,image',
        ]);

        $project = Project::where('user_id', $user->id)->find($validated['project_id']);
        if (!$project) {
            return response()->json(['message' => 'Project not found'], 404);
        }

        try {
            $this->gate->assertCanUseStorage($user);
        } catch (PlanLimitException $e) {
            return response()->json(['message' => $e->getMessage()] + $e->toArray(), 429);
        }

        $tmpDir = storage_path("app/imports/{$user->id}/" . uniqid('', true));
        try {
            $meta = $this->downloader->download($validated['url'], $tmpDir);
        } catch (Throwable $e) {
            return response()->json(['message' => 'Import failed: ' . $e->getMessage()], 502);
        }

        // Move into the user's project storage and create the MediaFile row.
        $relativeDir = "media/{$user->id}/{$project->id}";
        $destDir = Storage::disk('public')->path($relativeDir);
        if (!is_dir($destDir)) {
            mkdir($destDir, 0755, true);
        }
        $finalName = $validated['filename'] ?? $meta['filename'];
        $relativePath = $relativeDir . '/' . $finalName;
        $absolutePath = $destDir . '/' . $finalName;
        rename($meta['path'], $absolutePath);
        @rmdir($tmpDir);

        $type = $validated['type'] ?? 'video';
        $media = $project->mediaFiles()->create([
            'user_id' => $user->id,
            'name' => $meta['title'] ?? $finalName,
            'type' => $type,
            'mime_type' => mime_content_type($absolutePath) ?: 'application/octet-stream',
            'path' => $relativePath,
            'size' => $meta['size_bytes'],
            'duration' => $meta['duration_seconds'] !== null ? (int) round($meta['duration_seconds']) : null,
            'hash' => hash_file('sha256', $absolutePath),
        ]);
        $user->increment('storage_used', $meta['size_bytes']);

        return response()->json([
            'status' => 'completed',
            'media_id' => $media->id,
            'media' => $media,
        ]);
    }
}
