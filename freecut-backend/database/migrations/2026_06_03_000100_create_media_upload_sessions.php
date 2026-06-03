<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        // Backing store for MCP signed-URL uploads. The flow is:
        //   1. tool request_upload_url -> insert pending row, return token URL
        //   2. external client PUTs the file to /upload/{token} -> status = received
        //   3. tool confirm_upload -> move file into MediaFile, status = finalized
        // Expired rows (pending after expires_at) can be GC'd.
        Schema::create('media_upload_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->onDelete('cascade');
            $table->foreignId('project_id')->constrained()->onDelete('cascade');
            $table->uuid('token')->unique();
            $table->string('filename');
            $table->bigInteger('size_bytes');
            $table->string('content_type')->nullable();
            $table->string('status')->default('pending')->index(); // pending|received|finalized|expired
            $table->string('received_path')->nullable();
            $table->foreignId('media_file_id')->nullable()->constrained()->nullOnDelete();
            $table->timestamp('expires_at');
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_upload_sessions');
    }
};
