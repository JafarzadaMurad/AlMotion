<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Plans: allow own API key per plan
        Schema::table('plans', function (Blueprint $table) {
            $table->boolean('can_use_own_api_key')->default(false)->after('features');
        });

        // Users: own API key + individual override
        Schema::table('users', function (Blueprint $table) {
            $table->text('own_openai_api_key')->nullable()->after('is_blocked');
            $table->boolean('can_use_own_api_key')->nullable()->after('own_openai_api_key'); // null = inherit from plan
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('can_use_own_api_key');
        });
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['own_openai_api_key', 'can_use_own_api_key']);
        });
    }
};
