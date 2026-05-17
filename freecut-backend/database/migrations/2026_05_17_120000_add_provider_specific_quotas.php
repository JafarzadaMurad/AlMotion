<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Plans get a separate monthly token cap per provider. The existing
        // max_ai_tokens_monthly column keeps acting as the OpenAI cap so
        // current plans keep working unchanged.
        Schema::table('plans', function (Blueprint $table) {
            $table->integer('anthropic_tokens_monthly')->default(0)->after('max_ai_tokens_monthly');
            $table->integer('gemini_tokens_monthly')->default(0)->after('anthropic_tokens_monthly');
        });

        // Users track per-provider usage in parallel to the existing
        // tokens_used_this_month (which is the OpenAI counter).
        Schema::table('users', function (Blueprint $table) {
            $table->integer('anthropic_tokens_used_this_month')->default(0)->after('tokens_used_this_month');
            $table->integer('gemini_tokens_used_this_month')->default(0)->after('anthropic_tokens_used_this_month');
        });

        // Each token_usages row now records which provider produced it so we
        // can break down usage by provider in dashboards/billing.
        Schema::table('token_usages', function (Blueprint $table) {
            $table->string('provider')->default('openai')->after('user_id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['anthropic_tokens_monthly', 'gemini_tokens_monthly']);
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['anthropic_tokens_used_this_month', 'gemini_tokens_used_this_month']);
        });
        Schema::table('token_usages', function (Blueprint $table) {
            $table->dropColumn('provider');
        });
    }
};
