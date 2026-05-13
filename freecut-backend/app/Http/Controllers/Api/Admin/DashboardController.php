<?php

namespace App\Http\Controllers\Api\Admin;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\Project;
use App\Models\MediaFile;
use App\Models\Plan;
use App\Models\TokenUsage;

class DashboardController extends Controller
{
    public function index()
    {
        return response()->json([
            'total_users' => User::count(),
            'total_projects' => Project::count(),
            'total_media_files' => MediaFile::count(),
            'total_storage_used' => User::sum('storage_used'),
            'total_tokens_used' => TokenUsage::sum('total_tokens'),
            'users_by_plan' => Plan::withCount('users')->get(['id', 'name', 'slug']),
            'recent_users' => User::with('plan')->latest()->take(5)->get(),
            'blocked_users' => User::where('is_blocked', true)->count(),
        ]);
    }
}
