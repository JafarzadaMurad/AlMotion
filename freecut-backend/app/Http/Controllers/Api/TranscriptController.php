<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Transcript;
use App\Models\Project;
use Illuminate\Http\Request;

class TranscriptController extends Controller
{
    /**
     * Get transcript for a specific media item in a project.
     */
    public function show(Request $request, Project $project, string $mediaId)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $transcript = Transcript::where('project_id', $project->id)
            ->where('media_id', $mediaId)
            ->first();

        if (!$transcript) {
            return response()->json(['transcript' => null]);
        }

        return response()->json(['transcript' => $transcript->transcript_data]);
    }

    /**
     * Save or update transcript for a specific media item in a project.
     */
    public function upsert(Request $request, Project $project, string $mediaId)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'transcript' => 'required|array',
            'transcript.text' => 'required|string',
            'transcript.segments' => 'required|array',
            'media_name' => 'nullable|string|max:255',
        ]);

        $transcript = Transcript::updateOrCreate(
            [
                'project_id' => $project->id,
                'media_id' => $mediaId,
            ],
            [
                'user_id' => $request->user()->id,
                'media_name' => $request->media_name,
                'transcript_data' => $request->transcript,
            ]
        );

        return response()->json([
            'message' => 'Transcript saved',
            'transcript' => $transcript->transcript_data,
        ]);
    }
}
