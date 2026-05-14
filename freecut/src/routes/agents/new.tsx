import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { ArrowLeft, Bot } from 'lucide-react';

// Future: custom tools (Instagram post, etc.) will be shown here
// For now, all built-in tools are included by default — no tool selection UI

export const Route = createFileRoute('/agents/new')({
  beforeLoad: () => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Login required');
  },
  component: NewAgentPage,
});

function NewAgentPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim() || !systemPrompt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      await ApiClient.post('/agents', {
        name: name.trim(),
        description: description.trim() || null,
        system_prompt: systemPrompt.trim(),
        allowed_tools: null, // all built-in tools enabled by default
      });
      navigate({ to: '/agents' });
    } catch (e: any) {
      setError(e?.message || e?.error || 'Failed to create agent');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="px-6 py-4 flex items-center gap-3">
          <Link to="/agents">
            <button className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-400 hover:text-white transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
          </Link>
          <h1 className="text-xl font-bold text-white">New Agent</h1>
        </div>
      </div>

      <div className="max-w-3xl px-6 py-8">
        {error && (
          <div className="mb-6 rounded-lg border border-red-800 bg-red-950 p-3 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Caption Styler, B-Roll Expert"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">Description <span className="text-zinc-600">(optional)</span></label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Short description of what this agent does"
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
            />
          </div>

          {/* System Prompt */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-1.5">System Prompt</label>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="You are a video editing assistant specialized in..."
              rows={8}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none resize-y font-mono text-sm"
            />
          </div>

          {/* Actions */}
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
              {saving ? 'Creating...' : 'Create Agent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
