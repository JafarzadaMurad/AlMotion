<?php

namespace App\Services\Mcp;

/**
 * Tiny JSON-RPC 2.0 envelope helpers. The MCP protocol is JSON-RPC over
 * HTTP, but we never need anything beyond `result` and `error` responses
 * and the standard four error codes plus our custom -32001 for plan limits.
 *
 * Spec: https://www.jsonrpc.org/specification
 */
final class JsonRpc
{
    public const PARSE_ERROR = -32700;
    public const INVALID_REQUEST = -32600;
    public const METHOD_NOT_FOUND = -32601;
    public const INVALID_PARAMS = -32602;
    public const INTERNAL_ERROR = -32603;

    // Application-defined codes (must be in the -32000..-32099 range)
    public const PLAN_LIMIT = -32001;
    public const AUTH_REQUIRED = -32002;

    public static function success(mixed $id, mixed $result): array
    {
        return [
            'jsonrpc' => '2.0',
            'id' => $id,
            'result' => $result,
        ];
    }

    public static function error(mixed $id, int $code, string $message, ?array $data = null): array
    {
        $error = ['code' => $code, 'message' => $message];
        if ($data !== null) {
            $error['data'] = $data;
        }
        return [
            'jsonrpc' => '2.0',
            'id' => $id,
            'error' => $error,
        ];
    }

    /**
     * Detect a JSON-RPC notification (no `id` field). Notifications get no
     * response per the spec.
     */
    public static function isNotification(array $envelope): bool
    {
        return !array_key_exists('id', $envelope);
    }
}
