<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Cross-device hydration needs the same metadata the frontend
        // extracts at import time. Duration / width / height already exist
        // on media_files; the only missing piece is fps so the timeline
        // can render at the right playback rate without remuxing.
        Schema::table('media_files', function (Blueprint $table) {
            $table->decimal('fps', 8, 3)->nullable()->after('height');
        });
    }

    public function down(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->dropColumn('fps');
        });
    }
};
