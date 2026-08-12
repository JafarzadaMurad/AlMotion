<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * What a call actually cost, alongside the token counts already recorded.
 *
 * Without these the usage table can say how many tokens were spent but not
 * what they were worth, which is the number anyone actually asks for.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('token_usages', function (Blueprint $table) {
            $table->decimal('real_cost_usd', 12, 6)->default(0)->after('total_tokens');
            $table->bigInteger('credits_charged')->default(0)->after('real_cost_usd');
        });
    }

    public function down(): void
    {
        Schema::table('token_usages', function (Blueprint $table) {
            $table->dropColumn(['real_cost_usd', 'credits_charged']);
        });
    }
};
