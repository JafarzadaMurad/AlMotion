<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

class PlanController extends Controller
{
    public function index()
    {
        $plans = Plan::withCount('users')->get();

        return response()->json($plans);
    }

    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'max_projects' => 'required|integer|min:1',
            'max_storage_mb' => 'required|integer|min:1',
            'max_ai_tokens_monthly' => 'required|integer|min:0',
            'anthropic_tokens_monthly' => 'nullable|integer|min:0',
            'gemini_tokens_monthly' => 'nullable|integer|min:0',
            'price_monthly' => 'required|numeric|min:0',
            'trial_days' => 'nullable|integer|min:0|max:3650',
            'stripe_price_id' => 'nullable|string|max:255',
            'is_default' => 'boolean',
            'can_use_own_api_key' => 'boolean',
            'features' => 'nullable|array',
            'allowed_models' => 'nullable|array',
            'allowed_models.*' => 'string',
            'can_generate_broll' => 'boolean',
            'can_create_agents' => 'boolean',
            'max_agents' => 'integer|min:0',
            'can_use_heygen' => 'boolean',
            'max_heygen_credits_monthly' => 'integer|min:0',
            'can_create_avatars' => 'boolean',
            'can_use_own_heygen_key' => 'boolean',
        ]);

        $validated['slug'] = Str::slug($validated['name']);

        // If this plan is default, unset others
        if (!empty($validated['is_default'])) {
            Plan::where('is_default', true)->update(['is_default' => false]);
        }

        $plan = Plan::create($validated);

        return response()->json($plan, 201);
    }

    public function show(Plan $plan)
    {
        $plan->loadCount('users');

        return response()->json($plan);
    }

    public function update(Request $request, Plan $plan)
    {
        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'max_projects' => 'integer|min:1',
            'max_storage_mb' => 'integer|min:1',
            'max_ai_tokens_monthly' => 'integer|min:0',
            'anthropic_tokens_monthly' => 'nullable|integer|min:0',
            'gemini_tokens_monthly' => 'nullable|integer|min:0',
            'price_monthly' => 'numeric|min:0',
            'trial_days' => 'nullable|integer|min:0|max:3650',
            'stripe_price_id' => 'nullable|string|max:255',
            'is_default' => 'boolean',
            'can_use_own_api_key' => 'boolean',
            'features' => 'nullable|array',
            'allowed_models' => 'nullable|array',
            'allowed_models.*' => 'string',
            'can_generate_broll' => 'boolean',
            'can_create_agents' => 'boolean',
            'max_agents' => 'integer|min:0',
            'can_use_heygen' => 'boolean',
            'max_heygen_credits_monthly' => 'integer|min:0',
            'can_create_avatars' => 'boolean',
            'can_use_own_heygen_key' => 'boolean',
        ]);

        if (isset($validated['name'])) {
            $validated['slug'] = Str::slug($validated['name']);
        }

        if (!empty($validated['is_default'])) {
            Plan::where('is_default', true)->where('id', '!=', $plan->id)->update(['is_default' => false]);
        }

        $plan->update($validated);

        return response()->json($plan);
    }

    public function destroy(Plan $plan)
    {
        if ($plan->users()->exists()) {
            return response()->json(['message' => 'Cannot delete plan with active users. Reassign them first.'], 422);
        }

        $plan->delete();

        return response()->json(['message' => 'Plan deleted']);
    }
}
