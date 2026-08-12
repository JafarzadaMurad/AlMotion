<?php

namespace App\Models;

// use Illuminate\Contracts\Auth\MustVerifyEmail;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Laravel\Sanctum\HasApiTokens;

class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasApiTokens, HasFactory, Notifiable;

    /**
     * The attributes that are mass assignable.
     *
     * @var list<string>
     */
    protected $fillable = [
        'name',
        'email',
        'password',
        'is_admin',
        'plan_id',
        'storage_used',
        'tokens_used_this_month',
        'tokens_reset_at',
        'credit_balance',
        'credits_used_this_month',
        'credits_granted_at',
        'is_blocked',
        'own_openai_api_key',
        'own_heygen_api_key',
        'can_use_own_api_key',
        'google_id',
        'avatar_url',
        'stripe_customer_id',
        'stripe_subscription_id',
        'subscription_status',
        'subscription_ends_at',
    ];

    /**
     * The attributes that should be hidden for serialization.
     *
     * @var list<string>
     */
    protected $hidden = [
        'password',
        'remember_token',
        'own_openai_api_key',
        'own_heygen_api_key',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'tokens_reset_at' => 'datetime',
            'credits_granted_at' => 'datetime',
            'credit_balance' => 'integer',
            'credits_used_this_month' => 'integer',
            'subscription_ends_at' => 'datetime',
            'password' => 'hashed',
            'is_admin' => 'boolean',
            'is_blocked' => 'boolean',
            'can_use_own_api_key' => 'boolean',
        ];
    }

    public function plan(): BelongsTo
    {
        return $this->belongsTo(\App\Models\Plan::class, 'plan_id');
    }

    public function projects(): HasMany
    {
        return $this->hasMany(\App\Models\Project::class);
    }

    public function mediaFiles(): HasMany
    {
        return $this->hasMany(\App\Models\MediaFile::class);
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(\App\Models\ChatMessage::class);
    }

    public function tokenUsages(): HasMany
    {
        return $this->hasMany(\App\Models\TokenUsage::class);
    }

    public function userAvatars(): HasMany
    {
        return $this->hasMany(\App\Models\UserAvatar::class);
    }
}
