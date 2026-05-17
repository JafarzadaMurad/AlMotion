import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';


const ALL_MODELS = [
  // OpenAI
  { id: 'gpt-4o-mini', label: 'GPT-4o Mini', desc: 'Fast & cheap' },
  { id: 'gpt-4o', label: 'GPT-4o', desc: 'Standard' },
  { id: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', desc: 'Latest fast' },
  { id: 'gpt-4.1', label: 'GPT-4.1', desc: 'Latest standard' },
  { id: 'o3-mini', label: 'o3 Mini', desc: 'Reasoning' },
  { id: 'o4-mini', label: 'o4 Mini', desc: 'Advanced reasoning' },
  { id: 'gpt-5', label: 'GPT-5', desc: 'Previous intelligent reasoning model' },
  { id: 'gpt-5-mini', label: 'GPT-5 mini', desc: 'Near-frontier intelligence for cost sensitive workloads' },
  { id: 'gpt-5-nano', label: 'GPT-5 nano', desc: 'Fastest, most cost-efficient version of GPT-5' },
  { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'Best intelligence at scale for agentic workflows' },
  { id: 'gpt-5.4-pro', label: 'GPT-5.4 pro', desc: 'Smarter and more precise responses' },
  { id: 'gpt-5.4-mini', label: 'GPT-5.4 mini', desc: 'Our strongest mini model yet' },
  { id: 'gpt-5.4-nano', label: 'GPT-5.4 nano', desc: 'Cheapest GPT-5.4-class model' },
  // Anthropic
  { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', desc: 'Anthropic top-tier reasoning' },
  { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: 'Anthropic balanced default' },
  { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', desc: 'Anthropic fast & cheap' },
];

interface AdminSettings {
  openai_api_key: string | null;
  openai_api_key_set: boolean;
  wavespeed_api_key: string | null;
  wavespeed_api_key_set: boolean;
  pexels_api_key: string | null;
  pexels_api_key_set: boolean;
  allow_user_api_keys: boolean;
  user_key_allowed_models: string[] | null;
  heygen_api_key: string | null;
  heygen_api_key_set: boolean;
  json2video_api_key: string | null;
  json2video_api_key_set: boolean;
  anthropic_api_key: string | null;
  anthropic_api_key_set: boolean;
}

export const Route = createFileRoute('/admin/settings')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) throw new Error('Admin access required');
  },
  component: SettingsPage,
});

function SettingsPage() {
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [openaiKey, setOpenaiKey] = useState('');
  const [pexelsKey, setPexelsKey] = useState('');
  const [wavespeedKey, setWavespeedKey] = useState('');
  const [heygenKey, setHeygenKey] = useState('');
  const [json2videoKey, setJson2videoKey] = useState('');
  const [anthropicKey, setAnthropicKey] = useState('');
  const [allowUserKeys, setAllowUserKeys] = useState(true);
  const [userKeyModels, setUserKeyModels] = useState<string[]>([]);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    ApiClient.get<AdminSettings>('/admin/settings')
      .then((data) => {
        setSettings(data);
        setAllowUserKeys(data.allow_user_api_keys);
        setUserKeyModels(data.user_key_allowed_models ?? ALL_MODELS.map((m) => m.id));
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const payload: Record<string, unknown> = {
        allow_user_api_keys: allowUserKeys,
        user_key_allowed_models: userKeyModels,
      };
      if (openaiKey) payload.openai_api_key = openaiKey;
      if (pexelsKey) payload.pexels_api_key = pexelsKey;
      if (wavespeedKey) payload.wavespeed_api_key = wavespeedKey;
      if (heygenKey) payload.heygen_api_key = heygenKey;
      if (json2videoKey) payload.json2video_api_key = json2videoKey;
      if (anthropicKey) payload.anthropic_api_key = anthropicKey;

      await ApiClient.put('/admin/settings', payload);

      // Reload settings
      const updated = await ApiClient.get<AdminSettings>('/admin/settings');
      setSettings(updated);
      setOpenaiKey('');
      setPexelsKey('');
      setWavespeedKey('');
      setHeygenKey('');
      setJson2videoKey('');
      setAnthropicKey('');
      setMessage('Settings saved successfully');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="text-zinc-400">Loading...</div>
      </div>
    );
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Settings</h1>

      <div className="max-w-2xl space-y-6">
        {message && (
          <div className="rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-300">
            {message}
          </div>
        )}

        {/* OpenAI API Key */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            OpenAI API Key
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Global API key used for all AI features. Users will use this key
            unless they set their own.
          </p>

          {settings?.openai_api_key_set && (
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-green-900 px-2 py-1 text-xs text-green-300">
                Set
              </span>
              <span className="font-mono text-sm text-zinc-400">
                {settings.openai_api_key}
              </span>
            </div>
          )}

          <input
            type="password"
            placeholder={
              settings?.openai_api_key_set
                ? 'Enter new key to replace...'
                : 'sk-...'
            }
            value={openaiKey}
            onChange={(e) => setOpenaiKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Pexels API Key */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Pexels API Key
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Used for stock video/image search in the editor.
          </p>

          {settings?.pexels_api_key_set && (
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-green-900 px-2 py-1 text-xs text-green-300">
                Set
              </span>
              <span className="font-mono text-sm text-zinc-400">
                {settings.pexels_api_key}
              </span>
            </div>
          )}

          <input
            type="password"
            placeholder={
              settings?.pexels_api_key_set
                ? 'Enter new key to replace...'
                : 'Enter Pexels API key...'
            }
            value={pexelsKey}
            onChange={(e) => setPexelsKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Allow User API Keys */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <label className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Allow User API Keys
              </h2>
              <p className="text-sm text-zinc-400">
                Global switch. When off, no user can use their own API key
                regardless of plan settings.
              </p>
            </div>
            <div
              onClick={() => setAllowUserKeys(!allowUserKeys)}
              className={`relative h-6 w-11 cursor-pointer rounded-full transition-colors ${allowUserKeys ? 'bg-blue-600' : 'bg-zinc-700'
                }`}
            >
              <div
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-transform ${allowUserKeys ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
              />
            </div>
          </label>
        </div>

        {/* Models allowed when using own key */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Models for Own API Key
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Which models users can select when using their own OpenAI API key.
          </p>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {ALL_MODELS.map((model) => (
              <label
                key={model.id}
                className="flex items-center gap-2 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 cursor-pointer hover:border-zinc-600"
              >
                <input
                  type="checkbox"
                  checked={userKeyModels.includes(model.id)}
                  onChange={(e) =>
                    setUserKeyModels((prev) =>
                      e.target.checked
                        ? [...prev, model.id]
                        : prev.filter((m) => m !== model.id)
                    )
                  }
                  className="rounded border-zinc-600 accent-blue-500"
                />
                <div>
                  <div className="text-sm font-medium text-white">{model.label}</div>
                  <div className="text-xs text-zinc-500">{model.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {/* WaveSpeed API Key (AI B-Roll Generation) */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            WaveSpeed API Key
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Used for AI-powered B-Roll video generation (Seedance model).
            Get your key from wavespeed.ai
          </p>

          {settings?.wavespeed_api_key_set && (
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-green-900 px-2 py-1 text-xs text-green-300">
                Set
              </span>
              <span className="font-mono text-sm text-zinc-400">
                {settings.wavespeed_api_key}
              </span>
            </div>
          )}

          <input
            type="password"
            placeholder={
              settings?.wavespeed_api_key_set
                ? 'Enter new key to replace...'
                : 'Enter WaveSpeed API key...'
            }
            value={wavespeedKey}
            onChange={(e) => setWavespeedKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* HeyGen API Key */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            HeyGen API Key
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Used for AI avatar video generation, video translation, and lip-sync.
            Get your key from app.heygen.com/settings
          </p>

          {settings?.heygen_api_key_set && (
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-green-900 px-2 py-1 text-xs text-green-300">
                Set
              </span>
              <span className="font-mono text-sm text-zinc-400">
                {settings.heygen_api_key}
              </span>
            </div>
          )}

          <input
            type="password"
            placeholder={
              settings?.heygen_api_key_set
                ? 'Enter new key to replace...'
                : 'Enter HeyGen API key...'
            }
            value={heygenKey}
            onChange={(e) => setHeygenKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* json2video API Key (transcription) */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            json2video API Key
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Used for media transcription (subtitles / SRT generation).
            The backend proxies transcription requests to the json2video
            server using this key.
          </p>

          {settings?.json2video_api_key_set && (
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-green-900 px-2 py-1 text-xs text-green-300">
                Set
              </span>
              <span className="font-mono text-sm text-zinc-400">
                {settings.json2video_api_key}
              </span>
            </div>
          )}

          <input
            type="password"
            placeholder={
              settings?.json2video_api_key_set
                ? 'Enter new key to replace...'
                : 'j2v_...'
            }
            value={json2videoKey}
            onChange={(e) => setJson2videoKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        {/* Anthropic (Claude) API Key */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">
            Anthropic (Claude) API Key
          </h2>
          <p className="mb-4 text-sm text-zinc-400">
            Used for Claude models (Opus 4.7, Sonnet 4.6, Haiku 4.5). Get
            your key from console.anthropic.com.
          </p>

          {settings?.anthropic_api_key_set && (
            <div className="mb-3 flex items-center gap-2">
              <span className="rounded bg-green-900 px-2 py-1 text-xs text-green-300">
                Set
              </span>
              <span className="font-mono text-sm text-zinc-400">
                {settings.anthropic_api_key}
              </span>
            </div>
          )}

          <input
            type="password"
            placeholder={
              settings?.anthropic_api_key_set
                ? 'Enter new key to replace...'
                : 'sk-ant-...'
            }
            value={anthropicKey}
            onChange={(e) => setAnthropicKey(e.target.value)}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
