<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function register(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|email|max:255|unique:users',
            'password' => 'required|string|min:8|confirmed',
            'plan_id' => 'nullable|integer|exists:plans,id',
        ]);

        // Plan resolution: caller may pass plan_id, but only free plans are
        // self-serve at signup. Paid tiers must go through Stripe Checkout
        // after registration. If no plan_id is sent (or a paid one slips
        // through), we fall back to the default Free plan.
        $selectedPlan = null;
        if (!empty($validated['plan_id'])) {
            $candidate = Plan::find($validated['plan_id']);
            if ($candidate && (float) $candidate->price_monthly === 0.0) {
                $selectedPlan = $candidate;
            }
        }
        if (!$selectedPlan) {
            $selectedPlan = Plan::where('is_default', true)->first()
                ?? Plan::where('price_monthly', 0)->orderBy('id')->first();
        }

        // Free plans can carry a trial_days cap; if set, mark when the
        // free access expires. Stripe webhooks for paid plans will
        // overwrite subscription_ends_at on upgrade.
        $endsAt = null;
        if ($selectedPlan && (int) ($selectedPlan->trial_days ?? 0) > 0) {
            $endsAt = now()->addDays((int) $selectedPlan->trial_days);
        }

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'plan_id' => $selectedPlan?->id,
            'subscription_ends_at' => $endsAt,
        ]);

        $token = $user->createToken('auth-token')->plainTextToken;
        $user->load('plan');

        return response()->json([
            'user' => $user,
            'token' => $token,
        ], 201);
    }

    public function login(Request $request)
    {
        $request->validate([
            'email' => 'required|string|email',
            'password' => 'required|string',
        ]);

        $user = User::where('email', $request->email)->first();

        if (!$user || !Hash::check($request->password, $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $token = $user->createToken('auth-token')->plainTextToken;
        $user->load('plan');

        return response()->json([
            'user' => $user,
            'token' => $token,
        ]);
    }

    public function logout(Request $request)
    {
        $request->user()->currentAccessToken()->delete();

        return response()->json(['message' => 'Logged out successfully']);
    }

    public function me(Request $request)
    {
        $user = $request->user();
        $user->load('plan');

        return response()->json($user);
    }
}
