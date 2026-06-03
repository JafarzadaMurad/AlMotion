<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            // Gate access to the MCP server (Model Context Protocol — lets
            // users drive AlMotion from Claude Desktop / Cursor etc.). Off
            // by default on existing plans; admin flips per-tier.
            $table->boolean('can_use_mcp')->default(false)->after('can_use_own_heygen_key');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('can_use_mcp');
        });
    }
};
