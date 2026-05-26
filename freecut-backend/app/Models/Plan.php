<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Plan extends Model
{
    protected $fillable = [
        'name',
        'slug',
        'max_projects',
        'max_storage_mb',
        'max_ai_tokens_monthly',
        'anthropic_tokens_monthly',
        'gemini_tokens_monthly',
        'price_monthly',
        'trial_days',
        'is_default',
        'features',
        'can_use_own_api_key',
        'allowed_models',
        'can_generate_broll',
        'can_create_agents',
        'max_agents',
        'can_use_heygen',
        'max_heygen_credits_monthly',
        'can_create_avatars',
        'can_use_own_heygen_key',
        'stripe_price_id',
    ];

    protected function casts(): array
    {
        return [
            'is_default' => 'boolean',
            'can_use_own_api_key' => 'boolean',
            'can_generate_broll' => 'boolean',
            'can_create_agents' => 'boolean',
            'can_use_heygen' => 'boolean',
            'can_create_avatars' => 'boolean',
            'can_use_own_heygen_key' => 'boolean',
            'features' => 'array',
            'allowed_models' => 'array',
            'price_monthly' => 'decimal:2',
        ];
    }

    public function users(): HasMany
    {
        return $this->hasMany(User::class);
    }
}
