<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatSession;
use App\Models\Project;
use Illuminate\Http\Request;

class ChatSessionController extends Controller
{
    public function index(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $sessions = $project->chatSessions()
            ->where('user_id', $request->user()->id)
            ->withCount('messages')
            ->latest()
            ->get();

        return response()->json($sessions);
    }

    public function store(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $session = ChatSession::create([
            'user_id' => $request->user()->id,
            'project_id' => $project->id,
            'title' => $request->input('title', 'New Chat'),
        ]);

        return response()->json($session, 201);
    }

    public function messages(Request $request, Project $project, ChatSession $session)
    {
        if ($session->user_id !== $request->user()->id || $session->project_id !== $project->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $perPage = $request->input('per_page', 50);
        $messages = $session->messages()
            ->latest()
            ->paginate($perPage);

        return response()->json($messages);
    }

    public function storeMessage(Request $request, Project $project, ChatSession $session)
    {
        if ($session->user_id !== $request->user()->id || $session->project_id !== $project->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'role' => 'required|in:user,assistant,system',
            'content' => 'required|string',
        ]);

        $message = $session->messages()->create([
            'user_id' => $request->user()->id,
            'project_id' => $project->id,
            ...$validated,
        ]);

        // Auto-title: set session title from first user message
        if ($session->title === 'New Chat' && $validated['role'] === 'user') {
            $session->update(['title' => mb_substr($validated['content'], 0, 60)]);
        }

        return response()->json($message, 201);
    }

    public function update(Request $request, Project $project, ChatSession $session)
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $session->update($request->validate([
            'title' => 'required|string|max:255',
        ]));

        return response()->json($session);
    }

    public function destroy(Request $request, Project $project, ChatSession $session)
    {
        if ($session->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $session->messages()->delete();
        $session->delete();

        return response()->json(['message' => 'Session deleted']);
    }
}
