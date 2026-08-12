<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Credit balances.
 *
 * Credits are an integer unit so a balance can never drift the way a float
 * running total does. One credit is $0.0001 (see AiPricingService::CREDITS_PER_USD),
 * small enough that the cheapest sensible call still costs at least one after
 * rounding, which keeps free work from being genuinely free.
 *
 * `credit_balance` is topped up by a purchase or by the monthly plan grant;
 * `credits_used_this_month` exists only for reporting, so "what did we spend"
 * survives a top-up resetting nothing.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->bigInteger('credit_balance')->default(0)->after('tokens_reset_at');
            $table->bigInteger('credits_used_this_month')->default(0)->after('credit_balance');
            $table->timestamp('credits_granted_at')->nullable()->after('credits_used_this_month');
        });

        Schema::table('plans', function (Blueprint $table) {
            // Granted on signup and each month. 0 means this plan grants none
            // and the user must buy credits.
            $table->bigInteger('monthly_credits')->default(0)->after('max_ai_tokens_monthly');
        });

        Schema::create('credit_purchases', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->bigInteger('credits');
            $table->decimal('amount_usd', 10, 2)->default(0);
            // 'purchase' | 'plan_grant' | 'admin_adjustment' — kept because a
            // balance alone cannot answer where the credits came from, and a
            // refund or a duplicated webhook needs something to reconcile to.
            $table->string('source')->default('purchase');
            $table->string('reference')->nullable();
            $table->text('note')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('credit_purchases');

        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('monthly_credits');
        });

        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['credit_balance', 'credits_used_this_month', 'credits_granted_at']);
        });
    }
};
