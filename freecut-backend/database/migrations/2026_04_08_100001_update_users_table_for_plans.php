<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Replace string 'plan' with foreign key 'plan_id'
            if (Schema::hasColumn('users', 'plan')) {
                $table->dropColumn('plan');
            }
            if (Schema::hasColumn('users', 'monthly_token_limit')) {
                $table->dropColumn('monthly_token_limit');
            }

            $table->foreignId('plan_id')->nullable()->after('is_admin')->constrained('plans')->nullOnDelete();
            $table->bigInteger('storage_used')->default(0)->after('plan_id'); // bytes used
            $table->boolean('is_blocked')->default(false)->after('tokens_reset_at');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropForeign(['plan_id']);
            $table->dropColumn(['plan_id', 'storage_used', 'is_blocked']);
            $table->string('plan')->default('free');
            $table->integer('monthly_token_limit')->default(50000);
        });
    }
};
