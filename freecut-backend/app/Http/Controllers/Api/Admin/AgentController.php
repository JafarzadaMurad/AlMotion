<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Agent;
use Illuminate\Http\Request;

class AgentController extends Controller
{
    public function index()
    {
        $agents = Agent::where('is_global', true)->latest()->get();
        return response()->json($agents);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'description' => 'nullable|string|max:1000',
            'system_prompt' => 'required|string',
            'allowed_tools' => 'nullable|array',
            'allowed_tools.*' => 'string',
            'icon' => 'nullable|string|max:50',
        ]);

        $validated['is_global'] = true;
        $validated['user_id'] = null;

        $agent = Agent::create($validated);

        return response()->json($agent, 201);
    }

    public function show(Agent $agent)
    {
        return response()->json($agent);
    }

    public function update(Request $request, Agent $agent)
    {
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

    public function destroy(Agent $agent)
    {
        $agent->delete();
        return response()->json(['message' => 'Agent deleted']);
    }
}
