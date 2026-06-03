<?php

use Illuminate\Support\Facades\Route;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\OpenAiController;
use App\Http\Controllers\Api\ProjectController;
use App\Http\Controllers\Api\MediaFileController;
use App\Http\Controllers\Api\ChatMessageController;
use App\Http\Controllers\Api\TranscriptController;
use App\Http\Controllers\Api\Admin\PlanController;
use App\Http\Controllers\Api\Admin\UserController;
use App\Http\Controllers\Api\Admin\DashboardController;
use App\Http\Controllers\Api\Admin\SettingsController;
use App\Http\Controllers\Api\UserSettingsController;
use App\Http\Controllers\Api\WaveSpeedController;
use App\Http\Controllers\Api\AgentController;
use App\Http\Controllers\Api\ChatSessionController;
use App\Http\Controllers\Api\HeyGenController;
use App\Http\Controllers\Api\SocialAuthController;
use App\Http\Controllers\Api\StripeController;
use App\Http\Controllers\Api\McpController;
use App\Http\Controllers\Api\McpTokenController;
use App\Http\Controllers\Api\MediaImportController;
use App\Http\Controllers\Api\MediaUploadController;

// Public routes
Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

// Public — so the registration form can render plan cards without a token.
Route::get('/plans/public', function () {
    return \App\Models\Plan::orderBy('price_monthly')->get([
        'id', 'name', 'slug', 'price_monthly', 'trial_days',
        'max_projects', 'max_storage_mb', 'max_ai_tokens_monthly',
        'is_default', 'stripe_price_id',
    ]);
});

// Google OAuth (public — browser hits these directly during redirect dance)
Route::get('/auth/google/redirect', [SocialAuthController::class, 'redirectToGoogle']);
Route::get('/auth/google/callback', [SocialAuthController::class, 'handleGoogleCallback']);

// Stripe webhook is public — Stripe servers POST here, no user token. Signature is
// verified inside the controller against STRIPE_WEBHOOK_SECRET when configured.
Route::post('/stripe/webhook', [StripeController::class, 'webhook']);

// MCP server endpoint — JSON-RPC 2.0 over HTTP. Auth is per-request via Sanctum
// bearer; rate limited because runaway Claude loops can otherwise rack up real
// money on HeyGen / WaveSpeed in the tool implementations.
Route::post('/mcp', [McpController::class, 'handle'])
    ->middleware(['auth:sanctum', 'throttle:60,1']);

// Signed-URL media upload accept endpoint. Public on purpose — the token in
// the URL IS the auth and is single-use, short-lived (1h). Used by Claude
// Code / Cursor to PUT local files without juggling Bearer headers.
Route::put('/upload/{token}', [MediaUploadController::class, 'acceptUpload']);

// Public proxy (no auth needed — serves HeyGen images through COEP)
Route::get('/heygen/proxy-image', [HeyGenController::class, 'proxyImage']);

// Protected routes
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/auth/logout', [AuthController::class, 'logout']);
    Route::get('/auth/me', [AuthController::class, 'me']);

    // Projects
    Route::apiResource('projects', ProjectController::class)->except(['store']);
    Route::post('/projects', [ProjectController::class, 'store'])->middleware('plan.limit:projects');

    // Media files (scoped to project)
    Route::get('/projects/{project}/media', [MediaFileController::class, 'index']);
    Route::post('/projects/{project}/media', [MediaFileController::class, 'store'])->middleware('plan.limit:storage');
    Route::get('/media/{medium}', [MediaFileController::class, 'show']);
    Route::put('/media/{medium}', [MediaFileController::class, 'update']);
    Route::delete('/media/{medium}', [MediaFileController::class, 'destroy']);

    // Media transcript (persist SRT data server-side)
    Route::get('/projects/{project}/transcripts/{mediaId}', [TranscriptController::class, 'show']);
    Route::put('/projects/{project}/transcripts/{mediaId}', [TranscriptController::class, 'upsert']);

    // Chat messages (scoped to project) — legacy
    Route::get('/projects/{project}/chat', [ChatMessageController::class, 'index']);
    Route::post('/projects/{project}/chat', [ChatMessageController::class, 'store']);
    Route::delete('/chat/{chat}', [ChatMessageController::class, 'destroy']);

    // Chat sessions (scoped to project)
    Route::get('/projects/{project}/sessions', [ChatSessionController::class, 'index']);
    Route::post('/projects/{project}/sessions', [ChatSessionController::class, 'store']);
    Route::get('/projects/{project}/sessions/{session}/messages', [ChatSessionController::class, 'messages']);
    Route::post('/projects/{project}/sessions/{session}/messages', [ChatSessionController::class, 'storeMessage']);
    Route::put('/projects/{project}/sessions/{session}', [ChatSessionController::class, 'update']);
    Route::delete('/projects/{project}/sessions/{session}', [ChatSessionController::class, 'destroy']);

    // OpenAI proxy (with token limit check)
    Route::post('/openai/chat', [OpenAiController::class, 'proxy'])->middleware('plan.limit:tokens');
    Route::post('/openai/transcribe', [OpenAiController::class, 'transcribe'])->middleware('plan.limit:tokens');
    Route::get('/user/ai-config', [OpenAiController::class, 'aiConfig']);

    // HeyGen Avatar Video
    Route::get('/heygen/config', [HeyGenController::class, 'config']);
    Route::get('/heygen/avatars', [HeyGenController::class, 'listAvatars']);
    Route::get('/heygen/avatar-looks', [HeyGenController::class, 'listAvatarLooks']);
    Route::post('/heygen/avatars', [HeyGenController::class, 'createAvatar']);
    Route::get('/heygen/voices', [HeyGenController::class, 'listVoices']);
    Route::post('/heygen/videos', [HeyGenController::class, 'createVideo']);
    Route::get('/heygen/videos/{videoId}', [HeyGenController::class, 'getVideo']);

    // WaveSpeed AI B-Roll generation
    Route::post('/wavespeed/generate', [WaveSpeedController::class, 'generate']);
    Route::get('/wavespeed/status/{requestId}', [WaveSpeedController::class, 'status']);
    Route::get('/wavespeed/config', [WaveSpeedController::class, 'config']);

    // json2video transcription proxy (avoids Vite proxy issues with large files)
    Route::post('/transcribe', [OpenAiController::class, 'transcribeProxy']);
    Route::get('/transcribe/{jobId}', [OpenAiController::class, 'transcribeStatus']);
    Route::post('/transcribe/srt', [OpenAiController::class, 'transcribeSrt']);

    // User settings (own API key)
    Route::get('/user/settings', [UserSettingsController::class, 'show']);
    Route::put('/user/settings', [UserSettingsController::class, 'update']);

    // MCP tokens — user mints / lists / revokes their own MCP-specific tokens
    // from /integrations/mcp. Plaintext is only returned on creation.
    Route::get('/user/mcp/tokens', [McpTokenController::class, 'index']);
    Route::post('/user/mcp/tokens', [McpTokenController::class, 'store']);
    Route::delete('/user/mcp/tokens/{id}', [McpTokenController::class, 'destroy']);

    // Media import / upload (companion to MCP tools)
    Route::post('/media/import-from-url', [MediaImportController::class, 'importFromUrl']);
    Route::post('/media/uploads', [MediaUploadController::class, 'createUploadSession']);
    Route::post('/media/uploads/{id}/finalize', [MediaUploadController::class, 'finalize']);

    // Stripe — billing
    Route::get('/plans', [\App\Http\Controllers\Api\Admin\PlanController::class, 'index']);
    Route::post('/stripe/checkout', [StripeController::class, 'createCheckout']);
    Route::post('/stripe/portal', [StripeController::class, 'createPortal']);
    Route::post('/stripe/sync', [StripeController::class, 'syncSubscription']);

    // User agents (list global + own, CRUD own)
    Route::apiResource('agents', AgentController::class);

    // Admin routes
    Route::middleware('admin')->prefix('admin')->group(function () {
        Route::get('/dashboard', [DashboardController::class, 'index']);
        Route::apiResource('plans', PlanController::class);
        Route::apiResource('users', UserController::class);
        Route::post('/users/{user}/assign-plan', [UserController::class, 'assignPlan']);
        Route::post('/users/{user}/toggle-block', [UserController::class, 'toggleBlock']);
        Route::get('/settings', [SettingsController::class, 'index']);
        Route::put('/settings', [SettingsController::class, 'update']);
        Route::apiResource('agents', \App\Http\Controllers\Api\Admin\AgentController::class)->names('admin.agents');

    });
});
