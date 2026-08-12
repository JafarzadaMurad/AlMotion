<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Per-model cost and margin.
 *
 * Model rates were previously nowhere: plans capped raw token counts, which
 * treats a Haiku token and an Opus token as the same thing when one costs
 * roughly thirty times the other. Storing the provider's real USD rate lets
 * usage be charged by what it actually costs, and the margin on top is what
 * the platform keeps.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('ai_pricings', function (Blueprint $table) {
            $table->id();
            $table->string('provider');
            $table->string('model');

            /**
             * How this row's rate is expressed. Chat bills per token; a
             * transcriber per minute of audio; a TTS voice per million
             * characters. One table means every model an operator can pick
             * has exactly one place its price is set.
             *   token      -> input/output/cached per 1M
             *   stt_minute -> unit_cost_usd is USD per minute
             *   tts_chars  -> unit_cost_usd is USD per 1M characters
             */
            $table->string('kind')->default('token');
            $table->decimal('unit_cost_usd', 12, 6)->default(0);

            // Provider's real cost, USD per 1M tokens.
            $table->decimal('input_cost_per_1m', 12, 6)->default(0);
            $table->decimal('output_cost_per_1m', 12, 6)->default(0);
            // Anthropic prompt-cache reads, usually a tenth of input. Ignoring
            // them would overcharge for tokens that were cheap.
            $table->decimal('cached_cost_per_1m', 12, 6)->default(0);

            $table->decimal('margin_multiplier', 8, 3)->default(3.000);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(['provider', 'model']);
            $table->index('is_active');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('ai_pricings');
    }
};
