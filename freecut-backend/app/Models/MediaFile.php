<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MediaFile extends Model
{
    protected $fillable = [
        'user_id',
        'project_id',
        'client_media_id',
        'name',
        'type',
        'mime_type',
        'path',
        'thumbnail_path',
        'size',
        'duration',
        'width',
        'height',
        'hash',
        'transcript_data',
    ];

    protected $casts = [
        'transcript_data' => 'array',
    ];

    protected $appends = ['url'];

    /**
     * Public URL the browser can fetch the bytes from. Requires
     * `php artisan storage:link` so /storage/* resolves to
     * storage/app/public/*.
     */
    public function getUrlAttribute(): ?string
    {
        return $this->path ? url('storage/' . ltrim($this->path, '/')) : null;
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
