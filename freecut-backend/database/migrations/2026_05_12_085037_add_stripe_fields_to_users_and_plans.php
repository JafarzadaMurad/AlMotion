<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->string('stripe_customer_id')->nullable()->unique()->after('avatar_url');
            $table->string('stripe_subscription_id')->nullable()->unique()->after('stripe_customer_id');
            // Mirrors Stripe's subscription.status: active / trialing / past_due / canceled / incomplete / etc.
            $table->string('subscription_status')->nullable()->after('stripe_subscription_id');
            // When the current paid period ends (Stripe `current_period_end`).
            $table->timestamp('subscription_ends_at')->nullable()->after('subscription_status');
        });

        Schema::table('plans', function (Blueprint $table) {
            // Stripe Price ID (e.g. price_1QabcXYZ). Free plan stays null.
            $table->string('stripe_price_id')->nullable()->after('price_monthly');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropUnique(['stripe_customer_id']);
            $table->dropUnique(['stripe_subscription_id']);
            $table->dropColumn(['stripe_customer_id', 'stripe_subscription_id', 'subscription_status', 'subscription_ends_at']);
        });

        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('stripe_price_id');
        });
    }
};
