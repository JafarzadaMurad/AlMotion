<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPlanLimits
{
    public function handle(Request $request, Closure $next, string $limitType): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        if ($user->is_blocked) {
            return response()->json(['message' => 'Your account has been blocked. Contact admin.'], 403);
        }

        $plan = $user->plan;

        // If no plan assigned, use most restrictive defaults
        $maxProjects = $plan?->max_projects ?? 3;
        $maxStorageMb = $plan?->max_storage_mb ?? 500;
        $maxTokens = $plan?->max_ai_tokens_monthly ?? 50000;

        switch ($limitType) {
            case 'projects':
                if ($user->projects()->count() >= $maxProjects) {
                    return response()->json([
                        'message' => 'Project limit reached for your plan.',
                        'limit' => $maxProjects,
                        'upgrade_required' => true,
                    ], 429);
                }
                break;

            case 'storage':
                $maxStorageBytes = $maxStorageMb * 1024 * 1024;
                if ($user->storage_used >= $maxStorageBytes) {
                    return response()->json([
                        'message' => 'Storage limit reached for your plan.',
                        'limit_mb' => $maxStorageMb,
                        'used_mb' => round($user->storage_used / 1024 / 1024, 2),
                        'upgrade_required' => true,
                    ], 429);
                }
                break;

            case 'tokens':
                // Reset monthly tokens if needed
                $this->resetTokensIfNeeded($user);

                if ($user->tokens_used_this_month >= $maxTokens) {
                    return response()->json([
                        'message' => 'AI token limit reached for this month.',
                        'limit' => $maxTokens,
                        'used' => $user->tokens_used_this_month,
                        'upgrade_required' => true,
                    ], 429);
                }
                break;
        }

        return $next($request);
    }

    private function resetTokensIfNeeded($user): void
    {
        if (!$user->tokens_reset_at || $user->tokens_reset_at->diffInDays(now()) >= 30) {
            $user->update([
                'tokens_used_this_month' => 0,
                'tokens_reset_at' => now(),
            ]);
        }
    }
}
