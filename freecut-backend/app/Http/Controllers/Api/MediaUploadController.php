<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

/**
 * Signed-URL upload flow for MCP clients that have shell access (Claude
 * Code, Cursor). Three-step protocol:
 *
 *   1. POST /media/uploads  -> we mint a token + return the public
 *      PUT URL. Stored as a pending row in media_upload_sessions.
 *   2. PUT /upload/{token}  -> the external client writes the raw bytes
 *      to disk; we mark the row received.
 *   3. POST /media/uploads/{id}/finalize  -> we move the file into the
 *      user's project storage and create a MediaFile row.
 *
 * Tokens expire after 1 hour. Sessions older than that with status
 * `pending` should be GC'd periodically (out of MVP scope).
 */
class MediaUploadController extends Controller
{
    public function createUploadSession(Request $request): JsonResponse
    {
        $user = $request->user();
        $validated = $request->validate([
            'project_id' => 'required|integer|exists:projects,id',
            'filename' => 'required|string|max:255',
            'size_bytes' => 'required|integer|min:1|max:524288000', // 500 MB
            'content_type' => 'nullable|string|max:127',
        ]);

        $project = Project::where('user_id', $user->id)->find($validated['project_id']);
        if (!$project) {
            return response()->json(['message' => 'Project not found'], 404);
        }

        $token = (string) Str::uuid();
        $session = DB::table('media_upload_sessions')->insertGetId([
            'user_id' => $user->id,
            'project_id' => $project->id,
            'token' => $token,
            'filename' => $validated['filename'],
            'size_bytes' => $validated['size_bytes'],
            'content_type' => $validated['content_type'] ?? null,
            'status' => 'pending',
            'expires_at' => now()->addHour(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $base = rtrim(config('app.url') ?: 'http://localhost', '/');
        return response()->json([
            'upload_id' => $session,
            'token' => $token,
            'upload_url' => "{$base}/api/upload/{$token}",
            'expires_at' => now()->addHour()->toIso8601String(),
            'curl_hint' => "curl -X PUT -T <local-file> -H 'Content-Type: " . ($validated['content_type'] ?? 'application/octet-stream') . "' {$base}/api/upload/{$token}",
        ]);
    }

    /**
     * Public endpoint — the token IS the auth. Accepts the raw request body
     * as the file contents and saves to storage/uploads/. Stays public
     * because we want clients to PUT from a shell without juggling Bearer
     * headers; the token is single-use and short-lived.
     */
    public function acceptUpload(Request $request, string $token): JsonResponse
    {
        $session = DB::table('media_upload_sessions')->where('token', $token)->first();
        if (!$session) {
            return response()->json(['message' => 'Unknown or expired token'], 404);
        }
        if ($session->status !== 'pending') {
            return response()->json(['message' => "Session already {$session->status}"], 409);
        }
        if (strtotime($session->expires_at) < time()) {
            DB::table('media_upload_sessions')->where('id', $session->id)->update(['status' => 'expired']);
            return response()->json(['message' => 'Session expired'], 410);
        }

        $relativeDir = "uploads/{$session->user_id}";
        $absoluteDir = storage_path("app/{$relativeDir}");
        if (!is_dir($absoluteDir)) {
            mkdir($absoluteDir, 0755, true);
        }
        $absolutePath = $absoluteDir . '/' . $token . '_' . basename($session->filename);

        // PHP stores the PUT body as a temporary file; pull it via input
        // stream rather than $request->file() since this is raw PUT, not
        // multipart.
        $input = fopen('php://input', 'rb');
        $out = fopen($absolutePath, 'wb');
        if ($input === false || $out === false) {
            return response()->json(['message' => 'Failed to open file streams'], 500);
        }
        stream_copy_to_stream($input, $out);
        fclose($input);
        fclose($out);

        DB::table('media_upload_sessions')->where('id', $session->id)->update([
            'status' => 'received',
            'received_path' => $absolutePath,
            'updated_at' => now(),
        ]);

        return response()->json([
            'message' => 'Upload received. Call POST /media/uploads/' . $session->id . '/finalize to register it.',
            'upload_id' => $session->id,
            'size_bytes' => filesize($absolutePath),
        ]);
    }

    public function finalize(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $session = DB::table('media_upload_sessions')->where('id', $id)->first();
        if (!$session || $session->user_id !== $user->id) {
            return response()->json(['message' => 'Upload session not found'], 404);
        }
        if ($session->status !== 'received') {
            return response()->json(['message' => "Cannot finalize: status is {$session->status}"], 409);
        }

        $project = Project::where('user_id', $user->id)->find($session->project_id);
        if (!$project) {
            return response()->json(['message' => 'Project no longer exists'], 404);
        }

        $relativeDir = "media/{$user->id}/{$project->id}";
        $destDir = Storage::disk('public')->path($relativeDir);
        if (!is_dir($destDir)) {
            mkdir($destDir, 0755, true);
        }
        $finalPath = $destDir . '/' . $session->filename;
        rename($session->received_path, $finalPath);
        $relativePath = $relativeDir . '/' . $session->filename;

        $type = match (true) {
            str_starts_with($session->content_type ?? '', 'video/') => 'video',
            str_starts_with($session->content_type ?? '', 'audio/') => 'audio',
            str_starts_with($session->content_type ?? '', 'image/') => 'image',
            default => 'video',
        };

        $media = $project->mediaFiles()->create([
            'user_id' => $user->id,
            'client_media_id' => $request->input('client_media_id'),
            'name' => $session->filename,
            'type' => $type,
            'mime_type' => $session->content_type ?: (mime_content_type($finalPath) ?: 'application/octet-stream'),
            'path' => $relativePath,
            'size' => filesize($finalPath),
            'hash' => hash_file('sha256', $finalPath),
        ]);
        $user->increment('storage_used', $media->size);

        DB::table('media_upload_sessions')->where('id', $session->id)->update([
            'status' => 'finalized',
            'media_file_id' => $media->id,
            'updated_at' => now(),
        ]);

        return response()->json([
            'status' => 'finalized',
            'media_id' => $media->id,
            'media' => $media,
        ]);
    }
}
