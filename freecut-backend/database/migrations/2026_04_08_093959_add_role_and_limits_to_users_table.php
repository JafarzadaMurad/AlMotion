<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->boolean('is_admin')->default(false)->after('email');
            $table->string('plan')->default('free')->after('is_admin'); // 'free', 'pro'
            $table->integer('monthly_token_limit')->default(50000)->after('plan');
            $table->integer('tokens_used_this_month')->default(0)->after('monthly_token_limit');
            $table->timestamp('tokens_reset_at')->nullable()->after('tokens_used_this_month');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['is_admin', 'plan', 'monthly_token_limit', 'tokens_used_this_month', 'tokens_reset_at']);
        });
    }
};
