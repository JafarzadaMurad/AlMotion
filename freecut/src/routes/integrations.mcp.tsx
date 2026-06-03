import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Copy, Check, Trash2, Plug, AlertCircle } from 'lucide-react';

export const Route = createFileRoute('/integrations/mcp')({
  component: McpIntegrationPage,
});

interface McpToken {
  id: number;
  name: string;
  abilities: string[];
  last_used_at: string | null;
  created_at: string;
}

interface CreatedToken {
  id: number;
  name: string;
  plaintext: string;
  abilities: string[];
  created_at: string;
  expires_at: string | null;
}

function McpIntegrationPage() {
  const user = useAuthStore((s) => s.user);
  const planAllowsMcp = (user?.plan as { can_use_mcp?: boolean } | undefined)?.can_use_mcp;

  const [tokens, setTokens] = useState<McpToken[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);
  const [revealedToken, setRevealedToken] = useState<CreatedToken | null>(null);
  const [error, setError] = useState<string | null>(null);

  const serverUrl = `${window.location.origin}/api/v1/mcp`;

  const load = async () => {
    setLoading(true);
    try {
      const data = await ApiClient.get<McpToken[]>('/user/mcp/tokens');
      setTokens(data);
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Failed to load tokens');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (planAllowsMcp) load();
    else setLoading(false);
  }, [planAllowsMcp]);

  const createToken = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    setError(null);
    try {
      const t = await ApiClient.post<CreatedToken>('/user/mcp/tokens', { name: newName.trim() });
      setRevealedToken(t);
      setNewName('');
      await load();
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Failed to create token');
    } finally {
      setCreating(false);
    }
  };

  const revokeToken = async (id: number) => {
    if (!confirm('Revoke this token? Any client using it will stop working.')) return;
    try {
      await ApiClient.delete(`/user/mcp/tokens/${id}`);
      await load();
    } catch (e) {
      setError((e as { message?: string })?.message ?? 'Failed to revoke token');
    }
  };

  if (!planAllowsMcp) {
    return (
      <div className="p-8">
        <h1 className="mb-2 text-2xl font-bold text-white">MCP Integration</h1>
        <div className="mt-6 max-w-2xl rounded-xl border border-amber-800 bg-amber-950/40 p-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-400" />
            <div>
              <h2 className="text-lg font-semibold text-white">
                MCP access is not included in your current plan
              </h2>
              <p className="mt-2 text-sm text-zinc-300">
                The MCP server lets you drive AlMotion from Claude Desktop,
                Claude Code, or Cursor — search projects, kick off
                transcription, generate avatar videos and B-roll, import
                videos from URLs, all by chatting with Claude.
              </p>
              <Link
                to="/billing"
                className="mt-4 inline-block rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                See plans
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center gap-3">
        <Plug className="h-6 w-6 text-blue-400" />
        <h1 className="text-2xl font-bold text-white">MCP Integration</h1>
      </div>
      <p className="mb-6 max-w-3xl text-sm text-zinc-400">
        AlMotion exposes an MCP server so Claude Desktop, Claude Code,
        Cursor, and other MCP-compatible clients can drive the platform on
        your behalf — list projects, transcribe media, generate avatar
        videos and B-roll, import videos from URLs. Create a token below,
        then paste one of the config snippets into your client.
      </p>

      {error && (
        <div className="mb-4 max-w-3xl rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {revealedToken && (
        <div className="mb-6 max-w-3xl rounded-xl border border-amber-700 bg-amber-950/50 p-5">
          <h3 className="mb-1 font-semibold text-amber-200">
            Token created — copy it now
          </h3>
          <p className="mb-3 text-xs text-amber-300/80">
            This is the only time you'll see the plaintext. Closing this
            box means you'll have to mint a new token.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-900 p-2">
            <code className="flex-1 break-all font-mono text-xs text-zinc-200">
              {revealedToken.plaintext}
            </code>
            <CopyButton text={revealedToken.plaintext} />
          </div>
          <button
            onClick={() => setRevealedToken(null)}
            className="mt-3 text-xs text-amber-300 hover:text-amber-100"
          >
            I've copied it — dismiss
          </button>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_1fr]">
        {/* Server URL + token creation */}
        <div className="space-y-6">
          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-1 text-lg font-semibold text-white">
              Server URL
            </h2>
            <p className="mb-3 text-xs text-zinc-400">
              All MCP clients should point at this URL.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 p-2">
              <code className="flex-1 font-mono text-sm text-zinc-200">{serverUrl}</code>
              <CopyButton text={serverUrl} />
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-1 text-lg font-semibold text-white">
              Create a new token
            </h2>
            <p className="mb-3 text-xs text-zinc-400">
              Give it a name so you can tell tokens apart on different
              machines (e.g. "Laptop Claude Desktop").
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                placeholder="My MacBook"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
              />
              <button
                onClick={createToken}
                disabled={creating || !newName.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create'}
              </button>
            </div>
          </section>

          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-3 text-lg font-semibold text-white">
              Active tokens
            </h2>
            {loading && <p className="text-sm text-zinc-400">Loading…</p>}
            {!loading && tokens.length === 0 && (
              <p className="text-sm text-zinc-500">
                No tokens yet. Create one above to get started.
              </p>
            )}
            <ul className="space-y-2">
              {tokens.map((t) => (
                <li
                  key={t.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-zinc-800 bg-zinc-800/50 p-3"
                >
                  <div>
                    <div className="text-sm font-medium text-white">{t.name}</div>
                    <div className="text-xs text-zinc-500">
                      Created {new Date(t.created_at).toLocaleDateString()}
                      {t.last_used_at && ` · Last used ${new Date(t.last_used_at).toLocaleDateString()}`}
                    </div>
                  </div>
                  <button
                    onClick={() => revokeToken(t.id)}
                    className="rounded p-2 text-zinc-400 hover:bg-red-950 hover:text-red-300"
                    title="Revoke"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          </section>
        </div>

        {/* Config snippets */}
        <div className="space-y-6">
          <ConfigSnippet
            title="Claude Desktop"
            subtitle="~/Library/Application Support/Claude/claude_desktop_config.json (macOS) or %APPDATA%\\Claude\\claude_desktop_config.json (Windows)"
            json={`{\n  "mcpServers": {\n    "almotion": {\n      "url": "${serverUrl}",\n      "headers": {\n        "Authorization": "Bearer YOUR_TOKEN_HERE"\n      }\n    }\n  }\n}`}
          />
          <ConfigSnippet
            title="Cursor"
            subtitle=".cursor/mcp.json in your project, or ~/.cursor/mcp.json globally"
            json={`{\n  "mcpServers": {\n    "almotion": {\n      "url": "${serverUrl}",\n      "headers": {\n        "Authorization": "Bearer YOUR_TOKEN_HERE"\n      }\n    }\n  }\n}`}
          />
          <ConfigSnippet
            title="Claude Code"
            subtitle="~/.claude.json or per-project .claude.json"
            json={`{\n  "mcpServers": {\n    "almotion": {\n      "url": "${serverUrl}",\n      "headers": {\n        "Authorization": "Bearer YOUR_TOKEN_HERE"\n      }\n    }\n  }\n}`}
          />

          <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h3 className="mb-2 text-sm font-semibold text-white">Try these prompts</h3>
            <ul className="space-y-1 text-xs text-zinc-400">
              <li>· "List my AlMotion projects"</li>
              <li>· "Import this YouTube video into project 1: https://youtu.be/..."</li>
              <li>· "Transcribe media id 5 in project 1"</li>
              <li>· "Generate a 5-second b-roll of a sunset over mountains"</li>
              <li>· "What HeyGen avatars do I have available?"</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
}

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button
      onClick={copy}
      className="shrink-0 rounded p-1.5 text-zinc-400 hover:bg-zinc-700 hover:text-white"
      title="Copy"
    >
      {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

function ConfigSnippet({
  title,
  subtitle,
  json,
}: {
  title: string;
  subtitle: string;
  json: string;
}) {
  return (
    <section className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white">{title}</h3>
        <CopyButton text={json} />
      </div>
      <p className="mb-3 text-xs text-zinc-500">{subtitle}</p>
      <pre className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-950 p-3 text-xs text-zinc-300">
        <code>{json}</code>
      </pre>
    </section>
  );
}
