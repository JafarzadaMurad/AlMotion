<?php

namespace App\Services\Ai;

/**
 * Tiny lookup: given a model ID, return the AiProvider that owns it. Bound
 * once in AppServiceProvider so controllers can resolve via the container.
 */
class ProviderRegistry
{
    /** @var AiProvider[] */
    private array $providers;

    /** @param AiProvider[] $providers */
    public function __construct(array $providers)
    {
        $this->providers = $providers;
    }

    public function forModel(string $model): ?AiProvider
    {
        foreach ($this->providers as $provider) {
            if ($provider->supportsModel($model)) {
                return $provider;
            }
        }
        return null;
    }

    public function byName(string $name): ?AiProvider
    {
        foreach ($this->providers as $provider) {
            if ($provider->name() === $name) {
                return $provider;
            }
        }
        return null;
    }

    /** @return AiProvider[] */
    public function all(): array
    {
        return $this->providers;
    }

    /**
     * Every model ID the platform recognizes, across all providers. Used by
     * the admin Plan form and the user/ai-config endpoint.
     */
    public function allModels(): array
    {
        $models = [];
        foreach ($this->providers as $provider) {
            foreach ($provider->supportedModels() as $model) {
                $models[] = $model;
            }
        }
        return $models;
    }
}
