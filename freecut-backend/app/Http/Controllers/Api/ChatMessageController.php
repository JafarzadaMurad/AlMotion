<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ChatMessage;
use App\Models\Project;
use Illuminate\Http\Request;

class ChatMessageController extends Controller
{
    public function index(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $messages = $project->chatMessages()->oldest()->get();

        return response()->json($messages);
    }

    public function store(Request $request, Project $project)
    {
        if ($project->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $validated = $request->validate([
            'role' => 'required|in:user,assistant,system',
            'content' => 'required|string',
            'tool_calls' => 'nullable|array',
            'tool_results' => 'nullable|array',
            'tokens_used' => 'integer|min:0',
        ]);

        $message = $project->chatMessages()->create([
            'user_id' => $request->user()->id,
            ...$validated,
        ]);

        return response()->json($message, 201);
    }

    public function destroy(Request $request, ChatMessage $chat)
    {
        if ($chat->user_id !== $request->user()->id) {
            return response()->json(['message' => 'Forbidden'], 403);
        }

        $chat->delete();

        return response()->json(['message' => 'Message deleted']);
    }
}
