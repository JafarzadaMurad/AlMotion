<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('chat_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('title')->default('New Chat');
            $table->timestamps();
        });

        // Add session_id to chat_messages
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->foreignId('session_id')->nullable()->after('project_id')->constrained('chat_sessions')->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('chat_messages', function (Blueprint $table) {
            $table->dropConstrainedForeignId('session_id');
        });
        Schema::dropIfExists('chat_sessions');
    }
};
