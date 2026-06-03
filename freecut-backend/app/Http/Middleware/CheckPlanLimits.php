<?php

namespace App\Http\Middleware;

use App\Exceptions\PlanLimitException;
use App\Services\Plans\PlanGate;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class CheckPlanLimits
{
    public function __construct(private PlanGate $gate)
    {
    }

    public function handle(Request $request, Closure $next, string $limitType): Response
    {
        $user = $request->user();

        if (!$user) {
            return response()->json(['message' => 'Unauthenticated'], 401);
        }

        try {
            $this->gate->assertUserActive($user);

            switch ($limitType) {
                case 'projects':
                    $this->gate->assertCanCreateProject($user);
                    break;

                case 'storage':
                    $this->gate->assertCanUseStorage($user);
                    break;

                case 'tokens':
                    $this->gate->assertCanUseTokensFor($user, $request->json('model'));
                    break;
            }
        } catch (PlanLimitException $e) {
            $status = $e->kind === 'blocked' ? 403 : 429;
            return response()->json(
                ['message' => $e->getMessage()] + $e->toArray(),
                $status,
            );
        }

        return $next($request);
    }
}
