<?php

namespace App\Services\Mcp\Tools;

use App\Models\Plan;
use App\Models\User;
use App\Services\Mcp\Tool;

class ListPlansTool implements Tool
{
    public function name(): string
    {
        return 'list_plans';
    }

    public function description(): string
    {
        return 'List all subscription plans available on AlMotion (id, name, price, limits, capabilities). Useful when the user asks "what tiers exist?" or wants to compare features before upgrading.';
    }

    public function inputSchema(): array
    {
        return ['type' => 'object', 'properties' => new \stdClass(), 'additionalProperties' => false];
    }

    public function call(array $args, User $user): mixed
    {
        return Plan::orderBy('price_monthly')->get([
            'id', 'name', 'slug', 'price_monthly', 'trial_days',
            'max_projects', 'max_storage_mb', 'max_ai_tokens_monthly',
            'anthropic_tokens_monthly', 'gemini_tokens_monthly',
            'can_use_mcp', 'can_generate_broll', 'can_use_heygen',
            'is_default',
        ])->toArray();
    }
}
