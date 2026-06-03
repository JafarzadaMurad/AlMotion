<?php

namespace App\Services\Mcp;

use RuntimeException;

/**
 * Internal exceptions used by McpController to map onto JSON-RPC error
 * codes without leaking implementation details to clients.
 */
class MethodNotFoundException extends RuntimeException {}

class InvalidParamsException extends RuntimeException {}
