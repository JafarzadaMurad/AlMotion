<?php

namespace App\Providers;

use App\Services\Ai\AnthropicProvider;
use App\Services\Ai\ClaudeSubscriptionProvider;
use App\Services\Ai\GeminiProvider;
use App\Services\Ai\OpenAiProvider;
use App\Services\Ai\ProviderRegistry;
use Illuminate\Support\ServiceProvider;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        // Singleton list of every AiProvider the platform knows about. Order
        // matters only as a tiebreaker — the registry asks each provider in
        // turn whether it supports the requested model.
        $this->app->singleton(ProviderRegistry::class, function () {
            return new ProviderRegistry([
                new OpenAiProvider(),
                // Ahead of AnthropicProvider on purpose: it claims Claude
                // models only while the operator has switched Anthropic to
                // subscription billing, and must win when it does.
                new ClaudeSubscriptionProvider(),
                new AnthropicProvider(),
                new GeminiProvider(),
            ]);
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        //
    }
}
