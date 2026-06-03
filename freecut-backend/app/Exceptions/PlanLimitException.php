<?php

namespace App\Exceptions;

use RuntimeException;

/**
 * Thrown by App\Services\Plans\PlanGate when a user attempts an action that
 * exceeds their plan limits. CheckPlanLimits middleware and MCP tool dispatch
 * both catch this and translate it to their respective wire formats (HTTP
 * 429 JSON for the middleware, JSON-RPC `-32001` for MCP).
 */
class PlanLimitException extends RuntimeException
{
    public function __construct(
        string $message,
        public readonly string $kind, // 'projects' | 'storage' | 'tokens' | 'mcp_disabled'
        public readonly ?string $provider = null,
        public readonly ?int $limit = null,
        public readonly ?int $used = null,
    ) {
        parent::__construct($message);
    }

    public function toArray(): array
    {
        return array_filter([
            'kind' => $this->kind,
            'provider' => $this->provider,
            'limit' => $this->limit,
            'used' => $this->used,
            'upgrade_required' => true,
        ], fn ($v) => $v !== null);
    }
}
