<?php

namespace App\Http\Middleware;

use App\Services\Ai\ProviderRegistry;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPlanLimits
{
    public function __construct(private ProviderRegistry $providers)
    {
    }

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
                $this->resetTokensIfNeeded($user);

                // Per-provider quota: look at the requested model, find which
                // provider serves it, then compare that provider's user-usage
                // column against the plan's per-provider monthly cap.
                $requestedModel = $request->json('model', '');
                $provider = $requestedModel
                    ? $this->providers->forModel($requestedModel)
                    : null;

                if ($provider) {
                    $usageColumn = $provider->userUsageColumn();
                    $quotaColumn = $provider->planQuotaColumn();
                    $used = (int) ($user->{$usageColumn} ?? 0);
                    $cap = (int) ($plan?->{$quotaColumn} ?? 0);
                } else {
                    // Unknown model or no model in body — fall back to the
                    // OpenAI counter so existing routes that don't carry a
                    // model field (e.g. Whisper transcription) keep working.
                    $used = (int) ($user->tokens_used_this_month ?? 0);
                    $cap = (int) ($plan?->max_ai_tokens_monthly ?? 50000);
                }

                if ($cap > 0 && $used >= $cap) {
                    return response()->json([
                        'message' => 'AI token limit reached for this month.',
                        'provider' => $provider?->name() ?? 'openai',
                        'limit' => $cap,
                        'used' => $used,
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
                'anthropic_tokens_used_this_month' => 0,
                'gemini_tokens_used_this_month' => 0,
                'tokens_reset_at' => now(),
            ]);
        }
    }
}
