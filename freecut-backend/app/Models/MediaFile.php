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
        'fps',
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
     *
     * We compose against config('app.url') directly rather than calling
     * url() so the scheme is taken from APP_URL (https in production)
     * even on the off-chance TrustProxies isn't seeing X-Forwarded-Proto.
     */
    public function getUrlAttribute(): ?string
    {
        if (!$this->path) {
            return null;
        }
        $base = rtrim(config('app.url') ?: '', '/');
        $encodedPath = implode('/', array_map('rawurlencode', explode('/', ltrim($this->path, '/'))));
        return $base . '/storage/' . $encodedPath;
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
