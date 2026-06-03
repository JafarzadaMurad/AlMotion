<?php

namespace App\Services\Mcp;

use App\Models\User;

/**
 * Contract every MCP tool implements. Each Tool is a thin adapter — it
 * validates args (via inputSchema published to clients), invokes the
 * existing controller/service that already enforces plan limits and
 * business rules, and returns a JSON-serializable payload.
 */
interface Tool
{
    /** Stable tool identifier exposed to MCP clients (snake_case). */
    public function name(): string;

    /** Human-readable description shown to the LLM in tools/list. */
    public function description(): string;

    /**
     * JSON Schema describing the tool's input arguments. Use a minimal
     * subset: type=object, properties, required. Clients (Claude/Cursor)
     * use this to constrain the model's arguments.
     */
    public function inputSchema(): array;

    /**
     * Execute the tool. Return any JSON-serializable value — McpController
     * wraps it as `content: [{ type: "text", text: json_encode($result) }]`.
     *
     * Throw App\Exceptions\PlanLimitException for plan-quota failures (gets
     * translated to JSON-RPC -32001) or any other Throwable for internal
     * errors (translated to -32603).
     */
    public function call(array $args, User $user): mixed;
}
