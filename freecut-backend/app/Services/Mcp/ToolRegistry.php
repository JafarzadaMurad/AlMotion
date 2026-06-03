<?php

namespace App\Services\Mcp;

/**
 * In-memory registry of Tool implementations. Bound as a singleton in
 * McpServiceProvider, populated at boot time with every Tool subclass
 * the provider knows about. McpController asks the registry to resolve
 * `tools/call` invocations.
 */
class ToolRegistry
{
    /** @var array<string, Tool> name -> Tool */
    private array $tools = [];

    public function register(Tool $tool): void
    {
        $this->tools[$tool->name()] = $tool;
    }

    public function find(string $name): ?Tool
    {
        return $this->tools[$name] ?? null;
    }

    /** @return Tool[] */
    public function all(): array
    {
        return array_values($this->tools);
    }

    /**
     * Shape every registered tool into the MCP tools/list response format:
     * `{ name, description, inputSchema }`.
     */
    public function describe(): array
    {
        return array_map(
            fn (Tool $t) => [
                'name' => $t->name(),
                'description' => $t->description(),
                'inputSchema' => $t->inputSchema(),
            ],
            $this->all(),
        );
    }
}
