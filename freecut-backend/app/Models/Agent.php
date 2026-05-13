<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Agent extends Model
{
    protected $fillable = [
        'name',
        'description',
        'system_prompt',
        'allowed_tools',
        'icon',
        'is_global',
        'user_id',
    ];

    protected function casts(): array
    {
        return [
            'allowed_tools' => 'array',
            'is_global' => 'boolean',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
