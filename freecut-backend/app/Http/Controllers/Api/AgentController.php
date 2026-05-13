<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use Illuminate\Http\Request;

class AgentController extends Controller
{
    public function index(Request $request)
    {
        $user = $request->user();

        // Global agents + user's own agents
        $agents = Agent::where('is_global', true)
            ->orWhere('user_id', $user->id)
            ->latest()
            ->get()
            ->map(function ($agent) use ($user) {
                $agent->is_own = $agent->user_id === $user->id;
                return $agent;
            });

        return response()->json($agents);
    }

    public function show(Request $request, Agent $agent)
    {
        $user = $request->user();
        // User can view global agents or their own
        if (!$agent->is_global && $agent->user_id !== $user->id) {
            return response()->json(['error' => 'Agent not found.'], 404);
        }
        $agent->is_own = $agent->user_id === $user->id;
        return response()->json($agent);
    }

    public function store(Request $request)
    {
        $user = $request->user();
        $plan = $user->plan;

        if (!$plan || !$plan->can_create_agents) {
            return response()->json(['error' => 'Your plan does not allow creating custom agents.'], 403);
        }

        $userAgentCount = Agent::where('user_id', $user->id)->count();
        if ($userAgentCount >= $plan->max_agents) {
            return response()->json([
                'error' => "Agent limit reached ({$plan->max_agents}). Upgrade your plan.",
            ], 429);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'system_prompt' => 'required|string',
            'allowed_tools' => 'nullable|array',
            'allowed_tools.*' => 'string',
            'icon' => 'nullable|string|max:50',
        ]);

        $validated['is_global'] = false;
        $validated['user_id'] = $user->id;

        $agent = Agent::create($validated);

        return response()->json($agent, 201);
    }

    public function update(Request $request, Agent $agent)
    {
        $user = $request->user();

        if ($agent->user_id !== $user->id) {
            return response()->json(['error' => 'You can only edit your own agents.'], 403);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'description' => 'nullable|string|max:1000',
            'system_prompt' => 'sometimes|string',
            'allowed_tools' => 'nullable|array',
            'allowed_tools.*' => 'string',
            'icon' => 'nullable|string|max:50',
        ]);

        $agent->update($validated);

        return response()->json($agent);
    }

    public function destroy(Request $request, Agent $agent)
    {
        $user = $request->user();

        if ($agent->user_id !== $user->id) {
            return response()->json(['error' => 'You can only delete your own agents.'], 403);
        }

        $agent->delete();
        return response()->json(['message' => 'Agent deleted']);
    }
}
