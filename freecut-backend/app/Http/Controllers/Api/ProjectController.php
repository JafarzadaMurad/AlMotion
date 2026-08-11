<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class ProjectController extends Controller
{
    public function index(Request $request)
    {
        $projects = $request->user()->projects()
            ->withCount('mediaFiles')
            ->latest()
            ->get();

        return response()->json($projects);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string',
            'width' => 'integer|min:1',
            'height' => 'integer|min:1',
            'fps' => 'integer|min:1|max:120',
            'background_color' => 'nullable|string|max:20',
            'timeline_data' => 'nullable|array',
        ]);

        $project = $request->user()->projects()->create($validated);

        return response()->json($project, 201);
    }

    public function show(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $project->load(['mediaFiles', 'chatMessages']);

        return response()->json($project);
    }

    /**
     * Store the project card preview so the projects list shows it on every
     * device, not just the one that generated it.
     *
     * The image is produced in the browser from the timeline, so it is small
     * and always replaces the previous one — the old file is deleted rather
     * than accumulating a new copy on every autosave.
     */
    public function uploadThumbnail(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $request->validate([
            'thumbnail' => 'required|image|max:2048',
        ]);

        $previousPath = $project->thumbnail_path;

        $path = $request->file('thumbnail')->store(
            "thumbnails/projects/{$project->id}",
            'public'
        );

        $project->thumbnail_path = $path;
        $project->save();

        if ($previousPath && $previousPath !== $path) {
            Storage::disk('public')->delete($previousPath);
        }

        return response()->json([
            'thumbnail_path' => $project->thumbnail_path,
            'thumbnail_url' => $project->thumbnail_url,
        ]);
    }

    public function update(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string',
            'width' => 'integer|min:1',
            'height' => 'integer|min:1',
            'fps' => 'integer|min:1|max:120',
            'background_color' => 'nullable|string|max:20',
            'timeline_data' => 'nullable|array',
            'settings' => 'nullable|array',
        ]);

        $project->update($validated);

        return response()->json($project);
    }

    public function destroy(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $project->delete();

        return response()->json(['message' => 'Project deleted']);
    }
}
