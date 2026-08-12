<?php

namespace Database\Seeders;

use App\Models\AiPricing;
use Illuminate\Database\Seeder;

/**
 * Starting rates so no model bills at the fallback on day one.
 *
 * These are **starting points, not gospel**. Provider prices change and some
 * of these tiers are estimates from the published family rates; the admin AI
 * hub exists so an operator can correct any row. What matters is that every
 * model the registry advertises has a row, because a missing one silently
 * bills at fallback rates nobody chose.
 *
 * Uses updateOrCreate keyed on (provider, model), so re-running never
 * overwrites a rate an operator has already corrected... except it would, so
 * it only fills gaps: see the existence check below.
 */
class AiPricingSeeder extends Seeder
{
    /** [provider, model, input $/1M, output $/1M, cached $/1M] */
    private const RATES = [
        // OpenAI
        ['openai', 'gpt-4o', 2.50, 10.00, 1.25],
        ['openai', 'gpt-4o-mini', 0.15, 0.60, 0.075],
        ['openai', 'gpt-4.1', 2.00, 8.00, 0.50],
        ['openai', 'gpt-4.1-mini', 0.40, 1.60, 0.10],
        ['openai', 'o3-mini', 1.10, 4.40, 0.55],
        ['openai', 'o4-mini', 1.10, 4.40, 0.275],
        ['openai', 'gpt-5', 1.25, 10.00, 0.125],
        ['openai', 'gpt-5-mini', 0.25, 2.00, 0.025],
        ['openai', 'gpt-5-nano', 0.05, 0.40, 0.005],
        ['openai', 'gpt-5.4', 1.25, 10.00, 0.125],
        ['openai', 'gpt-5.4-pro', 15.00, 120.00, 1.50],
        ['openai', 'gpt-5.4-mini', 0.25, 2.00, 0.025],
        ['openai', 'gpt-5.4-nano', 0.05, 0.40, 0.005],

        // Anthropic — the 5 family
        ['anthropic', 'claude-opus-5', 15.00, 75.00, 1.50],
        ['anthropic', 'claude-sonnet-5', 3.00, 15.00, 0.30],
        ['anthropic', 'claude-fable-5', 1.00, 5.00, 0.10],

        // Anthropic — earlier ids, still selectable
        ['anthropic', 'claude-opus-4-7', 15.00, 75.00, 1.50],
        ['anthropic', 'claude-sonnet-4-6', 3.00, 15.00, 0.30],
        ['anthropic', 'claude-haiku-4-5', 1.00, 5.00, 0.10],
        ['anthropic', 'claude-haiku-4-5-20251001', 1.00, 5.00, 0.10],

        // Google
        ['gemini', 'gemini-3.1-pro-high', 2.50, 15.00, 0.31],
        ['gemini', 'gemini-3.1-pro-low', 1.25, 10.00, 0.31],
        ['gemini', 'gemini-3-flash', 0.30, 2.50, 0.075],
    ];

    private const DEFAULT_MARGIN = 3.0;

    public function run(): void
    {
        foreach (self::RATES as [$provider, $model, $input, $output, $cached]) {
            // Only fill gaps. Re-seeding must never overwrite a rate the
            // operator has corrected — that is their number, not ours.
            $exists = AiPricing::where('provider', $provider)->where('model', $model)->exists();
            if ($exists) {
                continue;
            }

            AiPricing::create([
                'provider' => $provider,
                'model' => $model,
                'kind' => 'token',
                'input_cost_per_1m' => $input,
                'output_cost_per_1m' => $output,
                'cached_cost_per_1m' => $cached,
                'margin_multiplier' => self::DEFAULT_MARGIN,
                'is_active' => true,
            ]);
        }
    }
}
