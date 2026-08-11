<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Project card thumbnails are generated in the browser and kept in IndexedDB,
 * so the projects list falls back to a placeholder icon on any device that did
 * not create the project. Storing the path server-side lets the list render
 * the real preview everywhere, the same way media files already do.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->string('thumbnail_path')->nullable()->after('background_color');
        });
    }

    public function down(): void
    {
        Schema::table('projects', function (Blueprint $table) {
            $table->dropColumn('thumbnail_path');
        });
    }
};
