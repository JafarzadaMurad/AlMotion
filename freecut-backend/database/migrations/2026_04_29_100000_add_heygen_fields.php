<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Plan fields
        Schema::table('plans', function (Blueprint $table) {
            $table->boolean('can_use_heygen')->default(false)->after('max_agents');
            $table->integer('max_heygen_credits_monthly')->default(0)->after('can_use_heygen');
            $table->boolean('can_create_avatars')->default(false)->after('max_heygen_credits_monthly');
            $table->boolean('can_use_own_heygen_key')->default(false)->after('can_create_avatars');
        });

        // User fields
        Schema::table('users', function (Blueprint $table) {
            $table->string('own_heygen_api_key')->nullable()->after('own_openai_api_key');
            $table->integer('heygen_credits_used_this_month')->default(0)->after('tokens_used_this_month');
        });

        // Track which user created which avatar (since all go to same HeyGen account)
        Schema::create('user_avatars', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('heygen_avatar_id'); // avatar look ID from HeyGen
            $table->string('heygen_group_id')->nullable(); // avatar group ID
            $table->string('name');
            $table->string('preview_url')->nullable();
            $table->string('type')->default('photo'); // photo, digital_twin, prompt
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('user_avatars');
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn(['own_heygen_api_key', 'heygen_credits_used_this_month']);
        });
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['can_use_heygen', 'max_heygen_credits_monthly', 'can_create_avatars', 'can_use_own_heygen_key']);
        });
    }
};
