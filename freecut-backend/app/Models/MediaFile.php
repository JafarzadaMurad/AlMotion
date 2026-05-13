<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class MediaFile extends Model
{
    protected $fillable = [
        'user_id',
        'project_id',
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

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }
}
