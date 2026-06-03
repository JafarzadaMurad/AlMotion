<?php

namespace App\Http\Controllers\Api;

use App\Exceptions\PlanLimitException;
use App\Http\Controllers\Controller;
use App\Services\Plans\PlanGate;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;

/**
 * CRUD for MCP-specific Sanctum tokens. These are personal access tokens
 * with the `mcp:*` ability set and a `mcp:` prefix on the name so the
 * /integrations/mcp UI can distinguish them from the regular session
 * token minted at login.
 *
 * The plaintext token is only returned by store(); subsequent index()
 * calls return masked metadata only.
 */
class McpTokenController extends Controller
{
    public function __construct(private PlanGate $gate)
    {
    }

    public function index(Request $request): JsonResponse
    {
        $user = $request->user();
        $tokens = $user->tokens()
            ->where('name', 'like', 'mcp:%')
            ->orderByDesc('created_at')
            ->get(['id', 'name', 'abilities', 'last_used_at', 'created_at'])
            ->map(fn ($t) => [
                'id' => $t->id,
                'name' => Str::after($t->name, 'mcp:'),
                'abilities' => $t->abilities,
                'last_used_at' => $t->last_used_at,
                'created_at' => $t->created_at,
            ]);
        return response()->json($tokens);
    }

    public function store(Request $request): JsonResponse
    {
        $user = $request->user();

        // Same plan gate that the MCP endpoint enforces — don't let users
        // mint tokens they can't use.
        try {
            $this->gate->assertCanUseMcp($user);
        } catch (PlanLimitException $e) {
            return response()->json(['message' => $e->getMessage()] + $e->toArray(), 403);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:64',
        ]);

        $tokenName = 'mcp:' . $validated['name'];
        $newToken = $user->createToken($tokenName, ['mcp:read'], now()->addYear());

        return response()->json([
            'id' => $newToken->accessToken->id,
            'name' => $validated['name'],
            'plaintext' => $newToken->plainTextToken,
            'abilities' => $newToken->accessToken->abilities,
            'created_at' => $newToken->accessToken->created_at,
            'expires_at' => $newToken->accessToken->expires_at,
        ], 201);
    }

    public function destroy(Request $request, int $id): JsonResponse
    {
        $user = $request->user();
        $deleted = $user->tokens()
            ->where('id', $id)
            ->where('name', 'like', 'mcp:%')
            ->delete();
        if (!$deleted) {
            return response()->json(['message' => 'Token not found'], 404);
        }
        return response()->json(['message' => 'Revoked']);
    }
}
