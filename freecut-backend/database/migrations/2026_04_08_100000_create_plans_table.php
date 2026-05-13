<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('plans', function (Blueprint $table) {
            $table->id();
            $table->string('name');               // Free, Pro, Business
            $table->string('slug')->unique();      // free, pro, business
            $table->integer('max_projects')->default(3);
            $table->bigInteger('max_storage_mb')->default(500);     // MB
            $table->integer('max_ai_tokens_monthly')->default(50000);
            $table->decimal('price_monthly', 8, 2)->default(0);
            $table->boolean('is_default')->default(false);
            $table->json('features')->nullable();  // extra features JSON
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plans');
    }
};
