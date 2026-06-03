<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\PlanLimitException;
use App\Http\Controllers\Controller;
use App\Services\Mcp\InvalidParamsException;
use App\Services\Mcp\JsonRpc;
use App\Services\Mcp\MethodNotFoundException;
use App\Services\Mcp\ToolRegistry;
use App\Services\Plans\PlanGate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * Streamable HTTP transport entry point for AlMotion's MCP server.
 *
 * Spec: https://modelcontextprotocol.io/specification
 * Transport: synchronous JSON-RPC 2.0 over HTTP POST. Streaming via SSE is
 * not used at MVP — every tool either returns synchronously or returns a
 * job_id that the client polls through a paired check_*_status tool.
 *
 * Auth is delegated to the Sanctum middleware on the route; this controller
 * trusts $request->user() and additionally enforces the can_use_mcp plan
 * flag through PlanGate.
 */
class McpController extends Controller
{
    private const PROTOCOL_VERSION = '2025-03-26';
    private const SERVER_NAME = 'almotion';
    private const SERVER_VERSION = '0.1.0';

    public function __construct(
        private ToolRegistry $registry,
        private PlanGate $gate,
    ) {
    }

    public function handle(Request $request): JsonResponse
    {
        $user = $request->user();

        // Plan-level gate first — if the user's plan doesn't include MCP,
        // every JSON-RPC method including tools/list is refused, so clients
        // get an actionable error during the very first handshake call.
        try {
            $this->gate->assertUserActive($user);
            $this->gate->assertCanUseMcp($user);
        } catch (PlanLimitException $e) {
            return response()->json(
                JsonRpc::error(null, JsonRpc::PLAN_LIMIT, $e->getMessage(), $e->toArray()),
            );
        }

        $envelope = $request->json()->all();

        // Batch requests (array of envelopes) are part of the JSON-RPC spec
        // but the MCP clients we target don't actually use them today. Accept
        // them defensively.
        if (array_is_list($envelope) && !empty($envelope)) {
            $responses = array_filter(
                array_map(fn ($e) => $this->handleSingle($e, $user), $envelope),
            );
            return response()->json(array_values($responses));
        }

        $response = $this->handleSingle($envelope, $user);
        if ($response === null) {
            // Notification — no body per spec, return 204.
            return response()->json(null, 204);
        }
        return response()->json($response);
    }

    /**
     * Process one JSON-RPC envelope. Returns null for notifications.
     */
    private function handleSingle(array $envelope, $user): ?array
    {
        $id = $envelope['id'] ?? null;
        $isNotification = !array_key_exists('id', $envelope);
        $method = $envelope['method'] ?? null;
        $params = $envelope['params'] ?? [];

        if (!is_string($method) || $method === '') {
            return $isNotification ? null : JsonRpc::error($id, JsonRpc::INVALID_REQUEST, 'Missing method');
        }

        try {
            $result = match ($method) {
                'initialize' => $this->initialize($params),
                'notifications/initialized' => null,
                'tools/list' => ['tools' => $this->registry->describe()],
                'tools/call' => $this->callTool($params, $user),
                'ping' => new \stdClass(), // {} — alive check
                default => $this->methodNotFound($method),
            };

            if ($isNotification) {
                return null;
            }
            return JsonRpc::success($id, $result);
        } catch (MethodNotFoundException $e) {
            return $isNotification ? null : JsonRpc::error($id, JsonRpc::METHOD_NOT_FOUND, $e->getMessage());
        } catch (InvalidParamsException $e) {
            return $isNotification ? null : JsonRpc::error($id, JsonRpc::INVALID_PARAMS, $e->getMessage());
        } catch (PlanLimitException $e) {
            return $isNotification ? null : JsonRpc::error($id, JsonRpc::PLAN_LIMIT, $e->getMessage(), $e->toArray());
        } catch (Throwable $e) {
            report($e);
            return $isNotification ? null : JsonRpc::error(
                $id,
                JsonRpc::INTERNAL_ERROR,
                config('app.debug') ? $e->getMessage() : 'Internal error',
            );
        }
    }

    private function initialize(array $params): array
    {
        return [
            'protocolVersion' => self::PROTOCOL_VERSION,
            'capabilities' => [
                'tools' => new \stdClass(), // empty object {} per spec
            ],
            'serverInfo' => [
                'name' => self::SERVER_NAME,
                'version' => self::SERVER_VERSION,
            ],
        ];
    }

    private function callTool(array $params, $user): array
    {
        $name = $params['name'] ?? null;
        if (!is_string($name) || $name === '') {
            throw new InvalidParamsException('tools/call requires a string `name`');
        }
        $tool = $this->registry->find($name);
        if (!$tool) {
            throw new MethodNotFoundException("Unknown tool: {$name}");
        }
        $args = $params['arguments'] ?? [];
        if (!is_array($args)) {
            throw new InvalidParamsException('tools/call `arguments` must be an object');
        }

        $output = $tool->call($args, $user);

        // MCP tools/call response shape: { content: [...], isError?: bool }
        return [
            'content' => [[
                'type' => 'text',
                'text' => is_string($output)
                    ? $output
                    : json_encode($output, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]],
        ];
    }

    private function methodNotFound(string $method): never
    {
        throw new MethodNotFoundException("Method not found: {$method}");
    }
}
