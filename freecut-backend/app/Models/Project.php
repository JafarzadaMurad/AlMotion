<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Project extends Model
{
    protected $fillable = [
        'user_id',
        'name',
        'description',
        'width',
        'height',
        'fps',
        'background_color',
        'timeline_data',
        'settings',
    ];

    protected function casts(): array
    {
        return [
            'timeline_data' => 'array',
            'settings' => 'array',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function mediaFiles(): HasMany
    {
        return $this->hasMany(MediaFile::class);
    }

    public function chatMessages(): HasMany
    {
        return $this->hasMany(ChatMessage::class);
    }

    public function chatSessions(): HasMany
    {
        return $this->hasMany(\App\Models\ChatSession::class);
    }
}
