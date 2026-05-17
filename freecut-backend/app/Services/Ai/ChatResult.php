<?php

namespace App\Services\Ai;

/**
 * Normalized result returned by every AiProvider::chat() call. `data` is
 * always shaped like an OpenAI chat completion response so the frontend
 * (and the rest of the backend) doesn't need to care which provider
 * actually answered.
 */
final class ChatResult
{
    public function __construct(
        public readonly array $data,
        public readonly int $status,
    ) {}

    public function successful(): bool
    {
        return $this->status >= 200 && $this->status < 300;
    }

    /**
     * Pull token counts out of the response if present. Returns the OpenAI
     * shape: ['prompt_tokens', 'completion_tokens', 'total_tokens'].
     */
    public function usage(): array
    {
        $usage = $this->data['usage'] ?? [];
        return [
            'prompt_tokens' => (int) ($usage['prompt_tokens'] ?? 0),
            'completion_tokens' => (int) ($usage['completion_tokens'] ?? 0),
            'total_tokens' => (int) ($usage['total_tokens'] ?? 0),
        ];
    }
}
