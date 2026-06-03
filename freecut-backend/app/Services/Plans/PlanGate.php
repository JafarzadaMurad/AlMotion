<?php

namespace App\Services\Plans;

use App\Exceptions\PlanLimitException;
use App\Models\User;
use App\Services\Ai\ProviderRegistry;

/**
 * Single source of truth for "can this user do X?" plan quota checks.
 * Both CheckPlanLimits middleware and MCP tool implementations call into
 * this service so the gating rules stay in one place.
 */
class PlanGate
{
    public function __construct(private ProviderRegistry $providers)
    {
    }

    public function assertCanCreateProject(User $user): void
    {
        $plan = $user->plan;
        $max = $plan?->max_projects ?? 3;
        $current = $user->projects()->count();
        if ($current >= $max) {
            throw new PlanLimitException(
                'Project limit reached for your plan.',
                kind: 'projects',
                limit: $max,
                used: $current,
            );
        }
    }

    public function assertCanUseStorage(User $user, int $additionalBytes = 0): void
    {
        $plan = $user->plan;
        $maxMb = $plan?->max_storage_mb ?? 500;
        $maxBytes = $maxMb * 1024 * 1024;
        if ($user->storage_used + $additionalBytes >= $maxBytes) {
            throw new PlanLimitException(
                'Storage limit reached for your plan.',
                kind: 'storage',
                limit: $maxMb,
                used: (int) round($user->storage_used / 1024 / 1024),
            );
        }
    }

    public function assertCanUseTokensFor(User $user, ?string $model): void
    {
        $this->resetTokensIfNeeded($user);

        $plan = $user->plan;
        $provider = $model ? $this->providers->forModel($model) : null;

        if ($provider) {
            $used = (int) ($user->{$provider->userUsageColumn()} ?? 0);
            $cap = (int) ($plan?->{$provider->planQuotaColumn()} ?? 0);
            $providerName = $provider->name();
        } else {
            $used = (int) ($user->tokens_used_this_month ?? 0);
            $cap = (int) ($plan?->max_ai_tokens_monthly ?? 50000);
            $providerName = 'openai';
        }

        if ($cap > 0 && $used >= $cap) {
            throw new PlanLimitException(
                'AI token limit reached for this month.',
                kind: 'tokens',
                provider: $providerName,
                limit: $cap,
                used: $used,
            );
        }
    }

    public function assertCanUseMcp(User $user): void
    {
        $plan = $user->plan;
        if (!$plan || !$plan->can_use_mcp) {
            throw new PlanLimitException(
                'MCP is not available on your plan. Upgrade required.',
                kind: 'mcp_disabled',
            );
        }
    }

    public function assertUserActive(User $user): void
    {
        if ($user->is_blocked) {
            throw new PlanLimitException(
                'Your account has been blocked. Contact admin.',
                kind: 'blocked',
            );
        }
    }

    private function resetTokensIfNeeded(User $user): void
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
