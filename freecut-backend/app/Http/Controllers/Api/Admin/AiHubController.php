<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\AiPricing;
use App\Models\Setting;
use App\Models\TokenUsage;
use App\Models\User;
use App\Services\Ai\ProviderRegistry;
use App\Services\Billing\AiPricingService;
use App\Services\Billing\CreditLedger;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

/**
 * One place that answers "which AI providers does this platform know about,
 * and what does each one own?".
 *
 * Keys, models and prices were three separate concerns on three parts of the
 * admin UI, which meant an operator could add a model on one screen and not
 * realise it had no price on another — so it silently billed at fallback
 * rates. They are all facets of a provider, so they are returned together.
 *
 * The descriptor is assembled from the same ProviderRegistry the runtime uses
 * rather than a restated list, so a provider added in code shows up here
 * without anyone editing this file.
 */
class AiHubController extends Controller
{
    /** Human-facing chrome. Anything not listed still appears, just plainer. */
    private const META = [
        'openai' => [
            'label' => 'OpenAI',
            'blurb' => 'GPT chat models and Whisper transcription.',
            'key_setting' => 'openai_api_key',
            'docs_url' => 'https://platform.openai.com/api-keys',
        ],
        'anthropic' => [
            'label' => 'Anthropic',
            'blurb' => 'Claude models. Can run on an API key or a Claude Code subscription.',
            'key_setting' => 'anthropic_api_key',
            'docs_url' => 'https://console.anthropic.com/settings/keys',
        ],
        'gemini' => [
            'label' => 'Google Gemini',
            'blurb' => 'Gemini models.',
            'key_setting' => 'gemini_api_key',
            'docs_url' => 'https://aistudio.google.com/apikey',
        ],
        'claude_subscription' => [
            'label' => 'Claude Code Subscription',
            'blurb' => 'Runs Claude models through the AI sidecar instead of a metered key.',
            'key_setting' => 'claude_subscription_tokens',
            'docs_url' => null,
        ],
    ];

    public function __construct(
        private ProviderRegistry $providers,
        private AiPricingService $pricing,
        private CreditLedger $ledger,
    ) {
    }

    /** Providers, their models, their prices and their key status, together. */
    public function index()
    {
        $pricingRows = AiPricing::orderBy('provider')->orderBy('model')->get();
        $byProvider = $pricingRows->groupBy('provider');

        $providers = [];
        foreach ($this->providers->all() as $provider) {
            $name = $provider->name();
            $meta = self::META[$name] ?? [
                'label' => ucfirst(str_replace('_', ' ', $name)),
                'blurb' => '',
                'key_setting' => $provider->apiKeySettingName(),
                'docs_url' => null,
            ];

            $key = Setting::get($meta['key_setting']);
            $models = $provider->supportedModels();
            $prices = $byProvider->get($name, collect());

            $providers[] = [
                'name' => $name,
                'label' => $meta['label'],
                'blurb' => $meta['blurb'],
                'key_setting' => $meta['key_setting'],
                'key_set' => !empty($key),
                'docs_url' => $meta['docs_url'],
                'models' => $models,
                // Surfaced so the UI can warn before a model quietly bills at
                // the fallback rate rather than the one an admin thinks it has.
                'models_without_pricing' => array_values(array_diff(
                    $models,
                    $prices->pluck('model')->all(),
                )),
                'pricing' => $prices->values(),
            ];
        }

        return response()->json([
            'providers' => $providers,
            'credits_per_usd' => AiPricingService::CREDITS_PER_USD,
            'anthropic_mode' => Setting::get('anthropic_mode') ?: 'api_key',
        ]);
    }

    public function storePricing(Request $request)
    {
        $validated = $this->validatePricing($request);

        $row = AiPricing::updateOrCreate(
            ['provider' => strtolower($validated['provider']), 'model' => $validated['model']],
            $validated,
        );

        return response()->json($row, 201);
    }

    public function updatePricing(Request $request, AiPricing $pricing)
    {
        $pricing->update($this->validatePricing($request, partial: true));

        return response()->json($pricing);
    }

    public function destroyPricing(AiPricing $pricing)
    {
        $pricing->delete();

        return response()->json(['message' => 'Removed']);
    }

    /**
     * Usage and spend, most recent first.
     *
     * Reported in both credits and USD: credits are what the user is charged,
     * dollars are what it cost us, and an operator needs to see the two side
     * by side to know whether the margin is holding.
     */
    public function usage(Request $request)
    {
        $since = now()->subDays((int) $request->query('days', 30));

        $byModel = TokenUsage::query()
            ->where('created_at', '>=', $since)
            ->select('provider', 'model')
            ->selectRaw('COUNT(*) as calls')
            ->selectRaw('SUM(total_tokens) as tokens')
            ->selectRaw('SUM(real_cost_usd) as cost_usd')
            ->selectRaw('SUM(credits_charged) as credits')
            ->groupBy('provider', 'model')
            ->orderByDesc('credits')
            ->get();

        return response()->json([
            'since' => $since->toIso8601String(),
            'by_model' => $byModel,
            'totals' => [
                'cost_usd' => round((float) $byModel->sum('cost_usd'), 4),
                'credits' => (int) $byModel->sum('credits'),
                'calls' => (int) $byModel->sum('calls'),
            ],
        ]);
    }

    /** Hand credits to a user directly — refunds, goodwill, internal accounts. */
    public function grantCredits(Request $request, User $user)
    {
        $validated = $request->validate([
            'credits' => 'required|integer|min:1',
            'note' => 'nullable|string|max:500',
        ]);

        $purchase = $this->ledger->grant(
            $user,
            $validated['credits'],
            'admin_adjustment',
            0,
            null,
            $validated['note'] ?? null,
        );

        return response()->json([
            'balance' => $user->credit_balance,
            'purchase' => $purchase,
        ]);
    }

    /**
     * @return array<string, mixed>
     */
    private function validatePricing(Request $request, bool $partial = false): array
    {
        $required = $partial ? 'sometimes' : 'required';

        return $request->validate([
            'provider' => "{$required}|string|max:64",
            'model' => "{$required}|string|max:128",
            'kind' => 'sometimes|string|in:token,stt_minute,tts_chars',
            'unit_cost_usd' => 'sometimes|numeric|min:0',
            'input_cost_per_1m' => 'sometimes|numeric|min:0',
            'output_cost_per_1m' => 'sometimes|numeric|min:0',
            'cached_cost_per_1m' => 'sometimes|numeric|min:0',
            // Below 1 the platform loses money on every call; allowed anyway
            // because a deliberate loss-leader is a decision an operator is
            // entitled to make, but never negative.
            'margin_multiplier' => 'sometimes|numeric|min:0|max:100',
            'is_active' => 'sometimes|boolean',
        ]);
    }
}
