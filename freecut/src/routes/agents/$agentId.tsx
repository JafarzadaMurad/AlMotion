import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { ArrowLeft, Bot } from 'lucide-react';

// Future: custom tools will be selectable here

interface Agent {
  id: number;
  name: string;
  description: string | null;
  system_prompt: string;
  allowed_tools: string[] | null;
  icon: string | null;
  is_global: boolean;
  is_own: boolean;
}

export const Route = createFileRoute('/agents/$agentId')({
  beforeLoad: () => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Login required');
  },
  component: EditAgentPage,
});

function EditAgentPage() {
  const { agentId } = Route.useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isOwn, setIsOwn] = useState(false);

  useEffect(() => {
    ApiClient.get<Agent>(`/agents/${agentId}`)
      .then((agent) => {
        setName(agent.name);
        setDescription(agent.description ?? '');
        setSystemPrompt(agent.system_prompt);
        setIsOwn(agent.is_own);
      })
      .catch(() => setError('Agent not found'))
      .finally(() => setLoading(false));
  }, [agentId]);

  const handleSave = async () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await ApiClient.put(`/agents/${agentId}`, {
        name: name.trim(),
        description: description.trim() || null,
        system_prompt: systemPrompt.trim(),
        allowed_tools: null,
      });
      navigate({ to: '/agents' });
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to update agent');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="px-6 py-4 flex items-center gap-3">
          <Link to="/agents">
            <button className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-white">Edit Agent</h1>
          {!isOwn && (
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-0.5 rounded">Read Only (Global)</span>
          )}
        </div>
      </div>

      <div className="max-w-3xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={!isOwn}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              disabled={!isOwn}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none disabled:opacity-50"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              disabled={!isOwn}
              rows={8}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none resize-y font-mono text-sm disabled:opacity-50"
            />
          </div>

          {isOwn && (
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-800">
              <Link to="/agents">
                <button className="px-4 py-2 rounded-lg border border-zinc-700 text-sm text-zinc-300 hover:bg-zinc-800">
                  Cancel
                </button>
              </Link>
              <button
                onClick={handleSave}
                disabled={saving || !name.trim() || !systemPrompt.trim()}
                className="px-6 py-2 rounded-lg bg-purple-600 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
