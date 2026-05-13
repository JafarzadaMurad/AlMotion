<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;

class UserController extends Controller
{
    public function index(Request $request)
    {
        $users = User::with('plan')
            ->withCount(['projects', 'tokenUsages'])
            ->when($request->search, function ($q, $search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            })
            ->latest()
            ->paginate(20);

        return response()->json($users);
    }

    public function show(User $user)
    {
        $user->load('plan');
        $user->loadCount(['projects', 'mediaFiles', 'tokenUsages']);

        // Token usage stats
        $user->setAttribute('total_tokens_used', $user->tokenUsages()->sum('total_tokens'));

        return response()->json($user);
    }

    public function update(Request $request, User $user)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'is_admin' => 'boolean',
            'plan_id' => 'nullable|exists:plans,id',
            'is_blocked' => 'boolean',
        ]);

        $user->update($validated);
        $user->load('plan');

        return response()->json($user);
    }

    public function destroy(User $user)
    {
        if ($user->is_admin) {
            return response()->json(['message' => 'Cannot delete admin user'], 422);
        }

        $user->delete();

        return response()->json(['message' => 'User deleted']);
    }

    public function assignPlan(Request $request, User $user)
    {
        $request->validate([
            'plan_id' => 'required|exists:plans,id',
        ]);

        $user->update(['plan_id' => $request->plan_id]);
        $user->load('plan');

        return response()->json($user);
    }

    public function toggleBlock(User $user)
    {
        if ($user->is_admin) {
            return response()->json(['message' => 'Cannot block admin user'], 422);
        }

        $user->update(['is_blocked' => !$user->is_blocked]);

        return response()->json([
            'message' => $user->is_blocked ? 'User blocked' : 'User unblocked',
            'user' => $user,
        ]);
    }
}
