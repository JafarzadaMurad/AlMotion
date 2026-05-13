<?php

namespace Database\Seeders;

use App\Models\Plan;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        // Create default plans
        $freePlan = Plan::firstOrCreate(['slug' => 'free'], [
            'name' => 'Free',
            'max_projects' => 3,
            'max_storage_mb' => 500,
            'max_ai_tokens_monthly' => 50000,
            'price_monthly' => 0,
            'is_default' => true,
        ]);

        $proPlan = Plan::firstOrCreate(['slug' => 'pro'], [
            'name' => 'Pro',
            'max_projects' => 25,
            'max_storage_mb' => 10000,
            'max_ai_tokens_monthly' => 500000,
            'price_monthly' => 9.99,
            'is_default' => false,
        ]);

        Plan::firstOrCreate(['slug' => 'business'], [
            'name' => 'Business',
            'max_projects' => 100,
            'max_storage_mb' => 50000,
            'max_ai_tokens_monthly' => 2000000,
            'price_monthly' => 29.99,
            'is_default' => false,
        ]);

        // Create admin user
        User::firstOrCreate(['email' => 'murad.cafarzada212@gmail.com'], [
            'name' => 'Murad Cafarzada',
            'password' => Hash::make('admin123456'),
            'is_admin' => true,
            'plan_id' => $proPlan->id,
        ]);
    }
}
