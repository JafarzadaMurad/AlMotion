<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            // How many days a free / trial plan lasts. NULL = no trial cap
            // (e.g. an indefinite Free tier). 0 means the plan is free but
            // has no time limit either — treat the same as NULL.
            $table->integer('trial_days')->nullable()->after('price_monthly');
        });
    }

    public function down(): void
    {
        Schema::table('plans', function (Blueprint $table) {
            $table->dropColumn('trial_days');
        });
    }
};
