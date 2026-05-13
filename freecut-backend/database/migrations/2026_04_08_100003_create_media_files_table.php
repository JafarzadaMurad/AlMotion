<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('media_files', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('name');
            $table->string('type');          // video, audio, image
            $table->string('mime_type');
            $table->string('path');          // storage path
            $table->string('thumbnail_path')->nullable();
            $table->bigInteger('size');      // bytes
            $table->integer('duration')->nullable(); // ms for video/audio
            $table->integer('width')->nullable();
            $table->integer('height')->nullable();
            $table->string('hash')->nullable();  // SHA-256 for dedup
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('media_files');
    }
};
