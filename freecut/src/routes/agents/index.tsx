import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Bot, Plus, Pencil, Trash2 } from 'lucide-react';

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

export const Route = createFileRoute('/agents/')({
  beforeLoad: () => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Login required');
  },
  component: AgentsListPage,
});

function AgentsListPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    ApiClient.get<Agent[]>('/agents')
      .then(setAgents)
      .finally(() => setLoading(false));
  }, []);

  const globalAgents = agents.filter(a => a.is_global);
  const myAgents = agents.filter(a => a.is_own);

  const handleDelete = async (agent: Agent) => {
    if (!confirm(`"${agent.name}" agentini silmək istəyirsiniz?`)) return;
    await ApiClient.delete(`/agents/${agent.id}`);
    setAgents(prev => prev.filter(a => a.id !== agent.id));
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold text-white">Agents</h1>
          <Link to="/agents/new">
            <button className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm font-medium text-white hover:bg-purple-700 transition-colors">
              <Plus className="w-4 h-4" />
              New Agent
            </button>
          </Link>
        </div>
      </div>

      <div className="px-6 py-8">
        {loading ? (
          <div className="text-zinc-400 text-center py-12">Loading...</div>
        ) : (
          <div className="space-y-8">
            {/* My Agents */}
            <div>
              <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                My Agents ({myAgents.length})
              </h2>
              {myAgents.length === 0 ? (
                <div className="rounded-xl border border-dashed border-zinc-800 p-8 text-center">
                  <Bot className="w-10 h-10 text-zinc-700 mx-auto mb-3" />
                  <p className="text-sm text-zinc-500 mb-4">You haven't created any agents yet.</p>
                  <Link to="/agents/new">
                    <button className="text-sm text-purple-400 hover:text-purple-300 font-medium">
                      + Create your first agent
                    </button>
                  </Link>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {myAgents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} onDelete={handleDelete} canEdit />
                  ))}
                </div>
              )}
            </div>

            {/* Global Agents */}
            {globalAgents.length > 0 && (
              <div>
                <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">
                  Global Agents ({globalAgents.length})
                </h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {globalAgents.map((agent) => (
                    <AgentCard key={agent.id} agent={agent} />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function AgentCard({ agent, onDelete, canEdit }: { agent: Agent; onDelete?: (a: Agent) => void; canEdit?: boolean }) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 hover:border-zinc-700 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-purple-500/15 border border-purple-500/20 flex items-center justify-center">
            <Bot className="w-4 h-4 text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white">{agent.name}</h3>
            {agent.is_global && (
              <span className="text-[10px] text-zinc-500">Global</span>
            )}
          </div>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1">
            <Link to="/agents/$agentId" params={{ agentId: String(agent.id) }}>
              <button className="p-1.5 rounded-md hover:bg-zinc-800 text-zinc-500 hover:text-white transition-colors">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </Link>
            {onDelete && (
              <button
                onClick={() => onDelete(agent)}
                className="p-1.5 rounded-md hover:bg-red-500/10 text-zinc-500 hover:text-red-400 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}
      </div>

      {agent.description && (
        <p className="text-xs text-zinc-400 mb-2">{agent.description}</p>
      )}

      <p className="text-[11px] text-zinc-500 line-clamp-2 mb-3">{agent.system_prompt}</p>

      <div className="text-[10px] text-zinc-600">
        {agent.allowed_tools === null ? 'All tools' : `${agent.allowed_tools.length} tools`}
      </div>
    </div>
  );
}
