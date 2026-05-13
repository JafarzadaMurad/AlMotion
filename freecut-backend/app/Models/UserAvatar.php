<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserAvatar extends Model
{
    protected $fillable = [
        'user_id',
        'heygen_avatar_id',
        'heygen_group_id',
        'name',
        'preview_url',
        'type',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
