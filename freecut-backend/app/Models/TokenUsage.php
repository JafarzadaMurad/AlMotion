<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class TokenUsage extends Model
{
    protected $fillable = [
        'user_id',
        'service',
        'model',
        'prompt_tokens',
        'completion_tokens',
        'total_tokens',
        'real_cost_usd',
        'credits_charged',
        'endpoint'
    ];
}
