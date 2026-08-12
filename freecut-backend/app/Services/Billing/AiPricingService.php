<?php

namespace App\Services\Billing;

use App\Models\AiPricing;
use Illuminate\Support\Facades\Log;

/**
 * Turns provider token counts into money, and money into credits.
 *
 * Plans used to cap raw token counts, which treats a Haiku token and an Opus
 * token as equivalent when one costs roughly thirty times the other. Pricing
 * each model by its real USD rate makes a budget mean the same thing whichever
 * model a user picks; the margin on top is what the platform keeps.
 */
class AiPricingService
{
    /**
     * 1 credit = $0.0001. Small enough that the cheapest sensible call still
     * rounds up to at least one credit, so no real work is silently free, and
     * large enough that a normal chat turn is a readable two- or three-digit
     * number rather than scientific notation.
     */
    public const CREDITS_PER_USD = 10_000;

    /**
     * Used when a model has no pricing row. Deliberately not cheap: an unknown
     * model must not be a way to get expensive work at a discount. Matches
     * mid-tier Claude rates.
     */
    private const FALLBACK_INPUT_PER_1M = 3.0;
    private const FALLBACK_OUTPUT_PER_1M = 15.0;
    private const FALLBACK_MARGIN = 3.0;

    /** @var array<string, ?AiPricing> */
    private array $cache = [];

    /**
     * Price one completion.
     *
     * @param  array{prompt_tokens?: int, completion_tokens?: int, cached_tokens?: int}  $usage
     * @return array{real_cost_usd: float, credits: int, priced_from: string}
     */
    public function priceUsage(string $provider, string $model, array $usage): array
    {
        $inputTokens = max(0, (int) ($usage['prompt_tokens'] ?? 0));
        $outputTokens = max(0, (int) ($usage['completion_tokens'] ?? 0));
        $cachedTokens = max(0, (int) ($usage['cached_tokens'] ?? 0));

        $row = $this->rowFor($provider, $model);

        if (!$row) {
            $realCostUsd = ($inputTokens / 1_000_000) * self::FALLBACK_INPUT_PER_1M
                + ($outputTokens / 1_000_000) * self::FALLBACK_OUTPUT_PER_1M;

            // Logged so the gap is visible: an admin who never sees this will
            // never know a model is being billed at a guess.
            Log::warning('No AI pricing row; billed at fallback rates', compact('provider', 'model'));

            return [
                'real_cost_usd' => round($realCostUsd, 6),
                'credits' => $this->toCredits($realCostUsd, self::FALLBACK_MARGIN),
                'priced_from' => 'fallback',
            ];
        }

        // Cached input is billed separately and far cheaper, so it has to come
        // out of the plain input count rather than being charged twice.
        $uncachedInput = max(0, $inputTokens - $cachedTokens);

        $realCostUsd = ($uncachedInput / 1_000_000) * $row->input_cost_per_1m
            + ($cachedTokens / 1_000_000) * $row->cached_cost_per_1m
            + ($outputTokens / 1_000_000) * $row->output_cost_per_1m;

        return [
            'real_cost_usd' => round($realCostUsd, 6),
            'credits' => $this->toCredits($realCostUsd, $row->margin_multiplier),
            'priced_from' => 'table',
        ];
    }

    /**
     * Credits for a given USD cost at a given margin, always rounded up so a
     * real call is never free.
     *
     * The inner round() is not cosmetic: 0.6 * 3 * 10000 evaluates to
     * 18000.000000000004 in binary floating point, and ceil() would turn that
     * into 18001 — overcharging by a credit on a clean number, which is the
     * kind of thing a customer notices and cannot explain.
     */
    public function toCredits(float $realCostUsd, float $margin): int
    {
        if ($realCostUsd <= 0) {
            return 0;
        }
        $exact = round($realCostUsd * max(0.0, $margin) * self::CREDITS_PER_USD, 6);
        return (int) max(1, ceil($exact));
    }

    /** Display helper: what a credit balance is worth to the user, in USD. */
    public function creditsToUsd(int $credits): float
    {
        return round($credits / self::CREDITS_PER_USD, 4);
    }

    /**
     * Per-request memo. The same row is read on every completion, and this
     * service is resolved per request, so a static cache would go stale the
     * moment an admin edited a rate.
     */
    private function rowFor(string $provider, string $model): ?AiPricing
    {
        $key = strtolower($provider) . '|' . $model;
        if (array_key_exists($key, $this->cache)) {
            return $this->cache[$key];
        }

        $row = AiPricing::query()
            ->where('provider', strtolower($provider))
            ->where('model', $model)
            ->where('is_active', true)
            ->first();

        return $this->cache[$key] = $row;
    }
}
