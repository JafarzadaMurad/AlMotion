<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Project;
use Illuminate\Http\Request;

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
