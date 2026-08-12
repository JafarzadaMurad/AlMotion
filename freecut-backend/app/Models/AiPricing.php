<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AiPricing extends Model
{
    protected $fillable = [
        'provider',
        'model',
        'kind',
        'unit_cost_usd',
        'input_cost_per_1m',
        'output_cost_per_1m',
        'cached_cost_per_1m',
        'margin_multiplier',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'unit_cost_usd' => 'float',
            'input_cost_per_1m' => 'float',
            'output_cost_per_1m' => 'float',
            'cached_cost_per_1m' => 'float',
            'margin_multiplier' => 'float',
            'is_active' => 'boolean',
        ];
    }
}
