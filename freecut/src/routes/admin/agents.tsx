import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';


const ALL_TOOLS = [
  { id: 'send_chat_message', label: 'Send Chat Message' },
  { id: 'get_timeline_info', label: 'Get Timeline Info' },
  { id: 'split_selected_clips', label: 'Split Clips' },
  { id: 'delete_selected_items', label: 'Delete Items' },
  { id: 'move_selected_items', label: 'Move Selected' },
  { id: 'move_items_by_id', label: 'Move by ID' },
  { id: 'select_items_by_id', label: 'Select by ID' },
  { id: 'remove_items', label: 'Remove Items' },
  { id: 'add_text_item', label: 'Add Text' },
  { id: 'update_item_style', label: 'Update Style' },
  { id: 'add_clip_to_timeline', label: 'Add Clip to Timeline' },
  { id: 'search_and_import_pexels', label: 'Search Pexels' },
  { id: 'generate_ai_broll', label: 'Generate AI B-Roll' },
  { id: 'transcribe_media', label: 'Transcribe Media' },
  { id: 'add_captions', label: 'Add Captions' },
  { id: 'get_media_library_info', label: 'Get Media Library' },
  { id: 'get_media_transcript', label: 'Get Transcript' },
  { id: 'capture_current_frame', label: 'Capture Current Frame' },
  { id: 'capture_video_frames', label: 'Capture Video Frames' },
];

const ICON_OPTIONS = [
  { id: 'bot', label: 'Bot' },
  { id: 'video', label: 'Video' },
  { id: 'sparkles', label: 'Sparkles' },
  { id: 'pen', label: 'Pen' },
  { id: 'palette', label: 'Palette' },
  { id: 'scissors', label: 'Scissors' },
  { id: 'music', label: 'Music' },
  { id: 'eye', label: 'Eye' },
  { id: 'brain', label: 'Brain' },
  { id: 'wand', label: 'Wand' },
];

interface AgentForm {
  name: string;
  description: string;
  system_prompt: string;
  allowed_tools: string[] | null;
  icon: string;
}

interface Agent {
  id: number;
  name: string;
  description: string | null;
  system_prompt: string;
  allowed_tools: string[] | null;
  icon: string | null;
  is_global: boolean;
  created_at: string;
}

const emptyForm: AgentForm = {
  name: '',
  description: '',
  system_prompt: '',
  allowed_tools: null,
  icon: 'bot',
};

export const Route = createFileRoute('/admin/agents')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) throw new Error('Admin access required');
  },
  component: AgentsPage,
});

function AgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [form, setForm] = useState<AgentForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  const [allToolsMode, setAllToolsMode] = useState(true);

  const loadAgents = () => {
    ApiClient.get<Agent[]>('/admin/agents')
      .then(setAgents)
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadAgents(); }, []);

  const openCreate = () => {
    setEditingAgent(null);
    setForm(emptyForm);
    setAllToolsMode(true);
    setShowForm(true);
  };

  const openEdit = (agent: Agent) => {
    setEditingAgent(agent);
    const hasAllTools = agent.allowed_tools === null;
    setAllToolsMode(hasAllTools);
    setForm({
      name: agent.name,
      description: agent.description ?? '',
      system_prompt: agent.system_prompt,
      allowed_tools: agent.allowed_tools,
      icon: agent.icon ?? 'bot',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        ...form,
        allowed_tools: allToolsMode ? null : form.allowed_tools,
      };
      if (editingAgent) {
        await ApiClient.put(`/admin/agents/${editingAgent.id}`, payload);
      } else {
        await ApiClient.post('/admin/agents', payload);
      }
      setShowForm(false);
      loadAgents();
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`Delete agent "${agent.name}"?`)) return;
    await ApiClient.delete(`/admin/agents/${agent.id}`);
    loadAgents();
  };

  const toggleTool = (toolId: string) => {
    setForm((f) => {
      const current = f.allowed_tools ?? [];
      const next = current.includes(toolId)
        ? current.filter((t) => t !== toolId)
        : [...current, toolId];
      return { ...f, allowed_tools: next };
    });
  };

  return (
    <div className="p-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white">Agents</h1>
        <button
          onClick={openCreate}
          className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700"
        >
          + New Agent
        </button>
      </div>

      {loading ? (
        <div className="text-zinc-400">Loading...</div>
      ) : agents.length === 0 ? (
        <div className="text-center py-12 text-zinc-500">
          <p className="text-lg mb-2">No agents created yet</p>
          <p className="text-sm">Create your first agent to customize AI behavior for different tasks.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {agents.map((agent) => (
            <div key={agent.id} className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
                  {agent.description && (
                    <p className="text-xs text-zinc-400 mt-1">{agent.description}</p>
                  )}
                </div>
                <span className="text-xs text-zinc-600">{agent.icon ?? 'bot'}</span>
              </div>

              <div className="mb-3">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">System Prompt</p>
                <p className="text-xs text-zinc-400 line-clamp-3">{agent.system_prompt}</p>
              </div>

              <div className="mb-4">
                <p className="text-[10px] uppercase tracking-wider text-zinc-500 mb-1">Tools</p>
                <p className="text-xs text-zinc-400">
                  {agent.allowed_tools === null
                    ? 'All tools'
                    : `${agent.allowed_tools.length} tool${agent.allowed_tools.length === 1 ? '' : 's'}`}
                </p>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => openEdit(agent)}
                  className="text-xs text-blue-400 hover:text-blue-300"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(agent)}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Agent Form Modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-4 text-lg font-semibold text-white">
              {editingAgent ? 'Edit Agent' : 'New Agent'}
            </h2>

            <div className="space-y-4">
              {/* Name + Icon */}
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="mb-1 block text-sm text-zinc-400">Name</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Video Redaktor"
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                  />
                </div>
                <div className="w-32">
                  <label className="mb-1 block text-sm text-zinc-400">Icon</label>
                  <select
                    value={form.icon}
                    onChange={(e) => setForm((f) => ({ ...f, icon: e.target.value }))}
                    className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                  >
                    {ICON_OPTIONS.map((opt) => (
                      <option key={opt.id} value={opt.id}>{opt.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="mb-1 block text-sm text-zinc-400">Description</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Short description of what this agent does"
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white focus:border-purple-500 focus:outline-none"
                />
              </div>

              {/* System Prompt */}
              <div>
                <label className="mb-1 block text-sm text-zinc-400">System Prompt</label>
                <textarea
                  value={form.system_prompt}
                  onChange={(e) => setForm((f) => ({ ...f, system_prompt: e.target.value }))}
                  placeholder="You are a video editing assistant specialized in..."
                  rows={6}
                  className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none resize-y"
                />
              </div>

              {/* Tools */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm text-zinc-400">Allowed Tools</label>
                  <label className="flex items-center gap-2 text-xs text-zinc-400">
                    <input
                      type="checkbox"
                      checked={allToolsMode}
                      onChange={(e) => {
                        setAllToolsMode(e.target.checked);
                        if (e.target.checked) {
                          setForm((f) => ({ ...f, allowed_tools: null }));
                        } else {
                          setForm((f) => ({ ...f, allowed_tools: ALL_TOOLS.map(t => t.id) }));
                        }
                      }}
                      className="rounded border-zinc-600"
                    />
                    All tools
                  </label>
                </div>

                {!allToolsMode && (
                  <div className="grid grid-cols-2 gap-1.5 max-h-48 overflow-y-auto">
                    {ALL_TOOLS.map((tool) => (
                      <label key={tool.id} className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1.5 cursor-pointer hover:border-zinc-600">
                        <input
                          type="checkbox"
                          checked={form.allowed_tools?.includes(tool.id) ?? false}
                          onChange={() => toggleTool(tool.id)}
                          className="rounded border-zinc-600 accent-purple-500"
                        />
                        <span className="text-xs text-white">{tool.label}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setShowForm(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !form.name || !form.system_prompt}
                className="rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
