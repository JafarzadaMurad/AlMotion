<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Frontend identifies media by a client UUID it generates at import
        // time. To make a project portable across devices we let the client
        // tell us that UUID on upload so the server-side row can be looked
        // up by it later from any device. Nullable because legacy rows and
        // server-only imports (MCP) won't have one.
        Schema::table('media_files', function (Blueprint $table) {
            $table->string('client_media_id')->nullable()->after('id')->index();
        });
    }

    public function down(): void
    {
        Schema::table('media_files', function (Blueprint $table) {
            $table->dropColumn('client_media_id');
        });
    }
};
