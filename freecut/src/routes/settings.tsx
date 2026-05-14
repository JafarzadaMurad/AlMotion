import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';
import { Check, X, Loader2 } from 'lucide-react';

interface UserSettings {
  can_use_own_api_key: boolean;
  has_own_openai_api_key: boolean;
  own_openai_api_key_masked: string | null;
  using_own_key: boolean;
  can_use_own_heygen_key: boolean;
  has_own_heygen_api_key: boolean;
  own_heygen_api_key_masked: string | null;
}

export const Route = createFileRoute('/settings')({
  beforeLoad: () => {
    const token = useAuthStore.getState().token;
    if (!token) throw new Error('Login required');
  },
  component: SettingsPage,
});

function SettingsPage() {
  const user = useAuthStore((s) => s.user);
  const [settings, setSettings] = useState<UserSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  const reload = () => ApiClient.get<UserSettings>('/user/settings').then(setSettings);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen">
        <div className="border-b border-zinc-800/60 bg-zinc-900/30">
          <div className="px-6 py-4"><h1 className="text-xl font-bold text-white">Settings</h1></div>
        </div>
        <div className="px-6 py-12 text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen">
      <div className="border-b border-zinc-800/60 bg-zinc-900/30">
        <div className="px-6 py-4"><h1 className="text-xl font-bold text-white">Settings</h1></div>
      </div>

      <div className="max-w-2xl px-6 py-8 space-y-6">
        {/* User Info */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white text-lg font-bold">
              {user?.name?.charAt(0)?.toUpperCase() ?? 'U'}
            </div>
            <div>
              <div className="text-white font-medium">{user?.name}</div>
              <div className="text-sm text-zinc-500">{user?.email}</div>
              <div className="text-xs text-purple-400 mt-0.5">{user?.plan?.name ?? 'Free'} Plan</div>
            </div>
          </div>
        </div>

        {message && (
          <div className={`rounded-lg border p-3 text-sm ${message.type === 'success' ? 'border-green-800 bg-green-950 text-green-300' : 'border-red-800 bg-red-950 text-red-300'}`}>
            {message.text}
          </div>
        )}

        {/* API Connections */}
        <div>
          <h2 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-4">API Connections</h2>
          <div className="space-y-3">
            {/* OpenAI */}
            <ApiKeyCard
              icon={
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.998 5.998 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.369v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.355-2.02 1.168a.076.076 0 0 1-.071 0l-4.83-2.786A4.504 4.504 0 0 1 2.34 7.872zm16.597 3.855l-5.833-3.387L15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.105v-5.678a.79.79 0 0 0-.407-.667zm2.01-3.023l-.141-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zm-12.64 4.135l-2.02-1.164a.08.08 0 0 1-.038-.057V6.075a4.5 4.5 0 0 1 7.375-3.453l-.142.08L8.704 5.46a.795.795 0 0 0-.393.681zm1.097-2.365l2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/>
                </svg>
              }
              name="OpenAI"
              description="AI assistant, video analysis, text generation"
              isConnected={settings?.has_own_openai_api_key ?? false}
              maskedKey={settings?.own_openai_api_key_masked}
              placeholder="sk-..."
              onConnect={async (key) => {
                await ApiClient.put('/user/settings', { own_openai_api_key: key });
                await reload();
                setMessage({ text: 'OpenAI API key connected', type: 'success' });
              }}
              onDisconnect={async () => {
                await ApiClient.put('/user/settings', { own_openai_api_key: null });
                await reload();
                setMessage({ text: 'OpenAI API key disconnected', type: 'success' });
              }}
              disabled={!settings?.can_use_own_api_key}
              disabledMessage="Your plan does not allow connecting your own OpenAI key"
            />

            {/* HeyGen */}
            <ApiKeyCard
              icon={
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z"/>
                </svg>
              }
              name="HeyGen"
              description="AI avatar video generation, voice cloning"
              isConnected={settings?.has_own_heygen_api_key ?? false}
              maskedKey={settings?.own_heygen_api_key_masked}
              placeholder="Enter HeyGen API key..."
              onConnect={async (key) => {
                await ApiClient.put('/user/settings', { own_heygen_api_key: key });
                await reload();
                setMessage({ text: 'HeyGen API key connected', type: 'success' });
              }}
              onDisconnect={async () => {
                await ApiClient.put('/user/settings', { own_heygen_api_key: null });
                await reload();
                setMessage({ text: 'HeyGen API key disconnected', type: 'success' });
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

function ApiKeyCard({
  icon,
  name,
  description,
  isConnected,
  maskedKey,
  placeholder,
  onConnect,
  onDisconnect,
  disabled,
  disabledMessage,
}: {
  icon: React.ReactNode;
  name: string;
  description: string;
  isConnected: boolean;
  maskedKey?: string | null;
  placeholder: string;
  onConnect: (key: string) => Promise<void>;
  onDisconnect: () => Promise<void>;
  disabled?: boolean;
  disabledMessage?: string;
}) {
  const [editing, setEditing] = useState(false);
  const [key, setKey] = useState('');
  const [saving, setSaving] = useState(false);

  const handleConnect = async () => {
    if (!key.trim()) return;
    setSaving(true);
    try {
      await onConnect(key.trim());
      setKey('');
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDisconnect = async () => {
    setSaving(true);
    try {
      await onDisconnect();
    } finally {
      setSaving(false);
    }
  };

  if (disabled) {
    return (
      <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4 opacity-60">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center text-zinc-500">{icon}</div>
          <div className="flex-1">
            <p className="text-sm font-medium text-zinc-400">{name}</p>
            <p className="text-xs text-zinc-600">{disabledMessage}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
      <div className="flex items-center gap-3">
        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isConnected ? 'bg-green-500/15 text-green-400' : 'bg-zinc-800 text-zinc-400'}`}>
          {icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-white">{name}</p>
            {isConnected && (
              <span className="flex items-center gap-1 text-[10px] text-green-400 bg-green-500/10 px-1.5 py-0.5 rounded-full">
                <Check className="w-2.5 h-2.5" />
                Connected
              </span>
            )}
          </div>
          <p className="text-xs text-zinc-500">{description}</p>
          {isConnected && maskedKey && (
            <p className="text-xs text-zinc-600 font-mono mt-1">{maskedKey}</p>
          )}
        </div>

        {isConnected ? (
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setEditing(!editing)}
              className="text-xs text-zinc-400 hover:text-white transition-colors"
            >
              Change
            </button>
            <button
              onClick={handleDisconnect}
              disabled={saving}
              className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <X className="w-3.5 h-3.5" />}
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditing(true)}
            className="px-3 py-1.5 rounded-lg bg-purple-600 text-xs font-medium text-white hover:bg-purple-700 transition-colors shrink-0"
          >
            Connect
          </button>
        )}
      </div>

      {editing && (
        <div className="mt-3 flex gap-2">
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder={placeholder}
            autoFocus
            onKeyDown={(e) => { if (e.key === 'Enter') handleConnect(); if (e.key === 'Escape') { setEditing(false); setKey(''); } }}
            className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-purple-500 focus:outline-none"
          />
          <button
            onClick={handleConnect}
            disabled={saving || !key.trim()}
            className="px-4 py-2 rounded-lg bg-purple-600 text-sm font-medium text-white hover:bg-purple-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Connect'}
          </button>
        </div>
      )}
    </div>
  );
}
