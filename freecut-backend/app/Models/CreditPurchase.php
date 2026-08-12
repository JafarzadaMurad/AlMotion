<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One credit movement in. Kept as rows rather than folded into the balance
 * because "how many did they get, when, and where from" is a question the
 * balance alone cannot answer — and a refund or a duplicated webhook needs
 * something to reconcile against.
 */
class CreditPurchase extends Model
{
    protected $fillable = [
        'user_id',
        'credits',
        'amount_usd',
        'source',
        'reference',
        'note',
    ];

    protected function casts(): array
    {
        return [
            'credits' => 'integer',
            'amount_usd' => 'float',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
