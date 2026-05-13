<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('transcripts', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('project_id')->constrained()->cascadeOnDelete();
            $table->string('media_id');  // Frontend UUID from IndexedDB
            $table->string('media_name')->nullable();
            $table->json('transcript_data'); // { text, segments[], language }
            $table->timestamps();

            // One transcript per media per project
            $table->unique(['project_id', 'media_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('transcripts');
    }
};
