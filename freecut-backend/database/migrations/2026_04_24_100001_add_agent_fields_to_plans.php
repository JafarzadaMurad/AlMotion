<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->boolean('can_create_agents')->default(false)->after('can_generate_broll');
            $table->integer('max_agents')->default(0)->after('can_create_agents');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn(['can_create_agents', 'max_agents']);
        });
    }
};
