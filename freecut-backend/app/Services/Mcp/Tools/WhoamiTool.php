<?php

namespace App\Services\Mcp\Tools;

use App\Models\User;
use App\Services\Mcp\Tool;

class WhoamiTool implements Tool
{
    public function name(): string
    {
        return 'whoami';
    }

    public function description(): string
    {
        return 'Get the authenticated AlMotion user (id, name, email, plan name, and remaining quotas). Use this once at session start to confirm the MCP connection works and to know what limits apply.';
    }

    public function inputSchema(): array
    {
        return ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => false];
    }

    public function call(array $args, User $user): mixed
    {
        $user->load('plan');
        $plan = $user->plan;
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'is_admin' => (bool) $user->is_admin,
            'plan' => $plan ? [
                'id' => $plan->id,
                'name' => $plan->name,
                'price_monthly' => (float) $plan->price_monthly,
                'max_projects' => $plan->max_projects,
                'max_storage_mb' => $plan->max_storage_mb,
                'max_ai_tokens_monthly' => $plan->max_ai_tokens_monthly,
                'anthropic_tokens_monthly' => $plan->anthropic_tokens_monthly,
                'gemini_tokens_monthly' => $plan->gemini_tokens_monthly,
                'can_use_mcp' => (bool) $plan->can_use_mcp,
                'can_generate_broll' => (bool) $plan->can_generate_broll,
                'can_use_heygen' => (bool) $plan->can_use_heygen,
            ] : null,
            'usage' => [
                'storage_used_mb' => (int) round(($user->storage_used ?? 0) / 1024 / 1024),
                'openai_tokens_used_this_month' => $user->tokens_used_this_month ?? 0,
                'anthropic_tokens_used_this_month' => $user->anthropic_tokens_used_this_month ?? 0,
                'gemini_tokens_used_this_month' => $user->gemini_tokens_used_this_month ?? 0,
            ],
            'subscription_status' => $user->subscription_status,
            'subscription_ends_at' => $user->subscription_ends_at,
        ];
    }
}
