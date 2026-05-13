<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plan;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use Laravel\Socialite\Facades\Socialite;

class SocialAuthController extends Controller
{
    /**
     * Step 1: redirect the user to Google's consent screen.
     * Stateless because the API has no session; CSRF is handled via the state param
     * round-trip enforced by Socialite.
     */
    public function redirectToGoogle(): RedirectResponse
    {
        return Socialite::driver('google')
            ->stateless()
            ->redirect();
    }

    /**
     * Step 2: Google redirects back here with ?code=. Exchange it for a profile,
     * find-or-create the user, mint a Sanctum token, and bounce to the frontend
     * with the token in a hash fragment so it isn't logged by intermediate proxies.
     */
    public function handleGoogleCallback(): RedirectResponse
    {
        $frontendUrl = rtrim(config('app.frontend_url', env('FRONTEND_URL', 'http://localhost:5273')), '/');

        try {
            $googleUser = Socialite::driver('google')->stateless()->user();
        } catch (\Throwable $e) {
            Log::warning('Google OAuth callback failed', ['error' => $e->getMessage()]);
            return redirect()->away("{$frontendUrl}/login?error=" . urlencode('google_oauth_failed'));
        }

        if (empty($googleUser->getId()) || empty($googleUser->getEmail())) {
            return redirect()->away("{$frontendUrl}/login?error=" . urlencode('google_missing_profile'));
        }

        $user = User::where('google_id', $googleUser->getId())->first();

        if (!$user) {
            // Link Google to an existing email-based account if one already exists.
            $user = User::where('email', $googleUser->getEmail())->first();
        }

        if ($user) {
            $user->fill([
                'google_id' => $googleUser->getId(),
                'avatar_url' => $googleUser->getAvatar() ?: $user->avatar_url,
            ])->save();
        } else {
            $defaultPlan = Plan::where('is_default', true)->first();
            $user = User::create([
                'name' => $googleUser->getName() ?: $googleUser->getNickname() ?: 'Google User',
                'email' => $googleUser->getEmail(),
                'google_id' => $googleUser->getId(),
                'avatar_url' => $googleUser->getAvatar(),
                'password' => null,
                'plan_id' => $defaultPlan?->id,
            ]);
        }

        if ($user->is_blocked) {
            return redirect()->away("{$frontendUrl}/login?error=" . urlencode('account_blocked'));
        }

        $token = $user->createToken('google-oauth')->plainTextToken;

        // Hash fragments aren't sent to servers, so the token won't appear in proxy/access logs
        // between the user's browser and our frontend.
        return redirect()->away("{$frontendUrl}/auth/callback#token=" . $token);
    }
}
