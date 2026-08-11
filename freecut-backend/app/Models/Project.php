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
        'thumbnail_path',
        'timeline_data',
        'settings',
    ];

    protected $appends = ['thumbnail_url'];

    protected function casts(): array
    {
        return [
            'timeline_data' => 'array',
            'settings' => 'array',
        ];
    }

    /**
     * Public URL for the project card preview, or null when none was uploaded.
     *
     * Composed against config('app.url') rather than url() for the same reason
     * MediaFile does it: behind the Caddy reverse proxy the inner request is
     * plain http, and a http:// asset URL on an https page is blocked as mixed
     * content. APP_URL carries the scheme the browser actually needs.
     */
    public function getThumbnailUrlAttribute(): ?string
    {
        if (!$this->thumbnail_path) {
            return null;
        }
        $base = rtrim(config('app.url') ?: '', '/');
        $encodedPath = implode('/', array_map('rawurlencode', explode('/', ltrim($this->thumbnail_path, '/'))));
        return $base . '/storage/' . $encodedPath;
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
