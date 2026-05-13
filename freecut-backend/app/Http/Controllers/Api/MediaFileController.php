<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\MediaFile;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class MediaFileController extends Controller
{
    public function index(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($project->mediaFiles()->latest()->get());
    }

    public function store(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'file' => 'required|file|max:512000', // 500MB max
            'type' => 'required|in:video,audio,image',
        ]);

        $file = $request->file('file');
        $path = $file->store("media/{$request->user()->id}/{$project->id}", 'public');

        $media = $project->mediaFiles()->create([
            'user_id' => $request->user()->id,
            'name' => $file->getClientOriginalName(),
            'type' => $request->type,
            'mime_type' => $file->getMimeType(),
            'path' => $path,
            'size' => $file->getSize(),
            'hash' => hash_file('sha256', $file->getRealPath()),
        ]);

        // Update user storage usage
        $request->user()->increment('storage_used', $file->getSize());

        return response()->json($media, 201);
    }

    public function show(Request $request, MediaFile $medium)
    {
        if ($medium->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        return response()->json($medium);
    }

    public function update(Request $request, MediaFile $medium)
    {
        if ($medium->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'duration' => 'nullable|integer',
            'width' => 'nullable|integer',
            'height' => 'nullable|integer',
        ]);

        $medium->update($validated);

        return response()->json($medium);
    }

    public function destroy(Request $request, MediaFile $medium)
    {
        if ($medium->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        // Delete file from storage
        Storage::disk('public')->delete($medium->path);
        if ($medium->thumbnail_path) {
            Storage::disk('public')->delete($medium->thumbnail_path);
        }

        // Update user storage
        $request->user()->decrement('storage_used', $medium->size);

        $medium->delete();

        return response()->json(['message' => 'Media deleted']);
    }

    public function getTranscript(Request $request, MediaFile $medium)
    {
        if ($medium->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        if (!$medium->transcript_data) {
            return response()->json(['transcript' => null]);
        }

        return response()->json(['transcript' => $medium->transcript_data]);
    }

    public function saveTranscript(Request $request, MediaFile $medium)
    {
        if ($medium->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'transcript' => 'required|array',
            'transcript.text' => 'required|string',
            'transcript.segments' => 'required|array',
            'transcript.language' => 'nullable|string',
        ]);

        $medium->update(['transcript_data' => $request->transcript]);

        return response()->json(['message' => 'Transcript saved', 'transcript' => $medium->transcript_data]);
    }
}
