import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ApiClient } from '@/infrastructure/api/api-client';
import { useAuthStore } from '@/features/auth/stores/auth-store';


const DEFAULT_TOOLS = [
  { id: 'send_chat_message', label: 'Send Chat Message', defaultDesc: 'Send a conversational message to the user.' },
  { id: 'get_timeline_info', label: 'Get Timeline Info', defaultDesc: 'Get information about the current timeline status, selections, and playback position.' },
  { id: 'split_selected_clips', label: 'Split Clips', defaultDesc: 'Split the currently selected clips at the playhead or a specific frame.' },
  { id: 'delete_selected_items', label: 'Delete Items', defaultDesc: 'Delete the currently selected items from the timeline.' },
  { id: 'move_selected_items', label: 'Move Selected', defaultDesc: 'Move selected items by a number of frames or to a specific position.' },
  { id: 'move_items_by_id', label: 'Move by ID', defaultDesc: 'Move specific items by their IDs.' },
  { id: 'select_items_by_id', label: 'Select by ID', defaultDesc: 'Select specific timeline items by their IDs.' },
  { id: 'remove_items', label: 'Remove Items', defaultDesc: 'Remove specific timeline items by their IDs.' },
  { id: 'add_text_item', label: 'Add Text', defaultDesc: 'Add a new text item to the timeline with full styling: text, startTimeSec, durationSec, color, backgroundColor, fontSize, fontFamily, fontWeight, positionY (0=top, 50=center, 100=bottom), positionX.' },
  { id: 'update_item_style', label: 'Update Style', defaultDesc: 'Update text/caption item properties: text (change content), color, backgroundColor, fontSize, fontFamily, fontWeight, fontStyle, textAlign, lineHeight, letterSpacing, stroke, textShadow, positionY, positionX, opacity.' },
  { id: 'add_clip_to_timeline', label: 'Add Clip', defaultDesc: 'Add an imported media asset to the timeline at a specific second.' },
  { id: 'search_and_import_pexels', label: 'Search Pexels', defaultDesc: 'Search Pexels for a stock video and import it into the Media Library.' },
  { id: 'generate_ai_broll', label: 'Generate AI B-Roll', defaultDesc: 'Generate an AI-created B-Roll video clip using WaveSpeed.' },
  { id: 'transcribe_media', label: 'Transcribe', defaultDesc: 'Transcribe a media item to generate a text transcript.' },
  { id: 'add_captions', label: 'Add Captions', defaultDesc: 'Insert the existing transcript as text captions on the timeline.' },
  { id: 'get_media_library_info', label: 'Get Media Library', defaultDesc: 'Get a list of all media assets currently imported into the project library.' },
  { id: 'get_media_transcript', label: 'Get Transcript', defaultDesc: 'Get the text transcript and segments for a specific media item.' },
  { id: 'ask_user', label: 'Ask User', defaultDesc: 'Ask the user a question and wait for their response. Pauses execution until user responds with text or picks an option.' },
  { id: 'list_heygen_avatars', label: 'List Avatars', defaultDesc: 'List available HeyGen avatars. Auto-shows avatar picker with search and gender filter. Returns selected avatar_id.' },
  { id: 'list_heygen_voices', label: 'List Voices', defaultDesc: 'List available HeyGen voices. Auto-shows voice picker with filters and audio preview.' },
  { id: 'generate_avatar_video', label: 'Generate Avatar Video', defaultDesc: 'Generate an AI avatar talking-head video using HeyGen. Avatar speaks the given script. Auto-imports to media library.' },
  { id: 'cut_time_range', label: 'Cut Time Range', defaultDesc: 'Remove a specific time range from a clip. Splits at start/end times and deletes the middle. Use to remove silence, unwanted sections, or trim clips.' },
  { id: 'capture_current_frame', label: 'Capture Frame', defaultDesc: 'Capture a screenshot of the current preview canvas.' },
  { id: 'capture_video_frames', label: 'Capture Frames', defaultDesc: 'Capture multiple frames from the video at specific timestamps for vision analysis.' },
];

interface AiConfigData {
  ai_system_prompt: string | null;
  ai_rules: string[];
  ai_tool_descriptions: Record<string, string>;
}

export const Route = createFileRoute('/admin/ai-config')({
  beforeLoad: () => {
    const user = useAuthStore.getState().user;
    if (!user?.is_admin) throw new Error('Admin access required');
  },
  component: AiConfigPage,
});

function AiConfigPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const [systemPrompt, setSystemPrompt] = useState('');
  const [rules, setRules] = useState<string[]>([]);
  const [newRule, setNewRule] = useState('');
  const [toolDescs, setToolDescs] = useState<Record<string, string>>({});

  useEffect(() => {
    ApiClient.get<AiConfigData>('/admin/settings')
      .then((data) => {
        setSystemPrompt(data.ai_system_prompt ?? '');
        setRules(data.ai_rules ?? []);
        setToolDescs(data.ai_tool_descriptions ?? {});
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      await ApiClient.put('/admin/settings', {
        ai_system_prompt: systemPrompt || null,
        ai_rules: rules,
        ai_tool_descriptions: toolDescs,
      });
      setMessage('AI configuration saved');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8"><div className="text-zinc-400">Loading...</div></div>;
  }

  return (
    <div className="p-8">
      <h1 className="mb-6 text-2xl font-bold text-white">AI Configuration</h1>

      <div className="max-w-3xl space-y-6">
        {message && (
          <div className="rounded-lg border border-green-800 bg-green-950 p-3 text-sm text-green-300">
            {message}
          </div>
        )}

        {/* System Prompt */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">System Prompt</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Base system prompt sent to the AI in every conversation. Always included — even when an agent is selected, this is prepended to the agent's prompt.
          </p>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            placeholder="You are an expert AI video editing assistant..."
            rows={6}
            className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none resize-y font-mono text-sm"
          />
        </div>

        {/* Rules */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">Rules</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Individual rules the AI must follow. Numbered and appended as "RULES:" section.
          </p>

          <div className="space-y-2 mb-4">
            {rules.map((rule, idx) => (
              <div key={idx} className="flex items-start gap-2 group">
                <span className="text-xs text-zinc-500 mt-2 w-6 shrink-0">{idx + 1}.</span>
                <textarea
                  value={rule}
                  onChange={(e) => {
                    const updated = [...rules];
                    updated[idx] = e.target.value;
                    setRules(updated);
                  }}
                  rows={2}
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white focus:border-blue-500 focus:outline-none resize-y"
                />
                <button
                  onClick={() => setRules(rules.filter((_, i) => i !== idx))}
                  className="mt-2 text-xs text-red-400 hover:text-red-300 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-2">
            <input
              type="text"
              value={newRule}
              onChange={(e) => setNewRule(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newRule.trim()) {
                  setRules([...rules, newRule.trim()]);
                  setNewRule('');
                }
              }}
              placeholder="Add a new rule..."
              className="flex-1 rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-blue-500 focus:outline-none"
            />
            <button
              onClick={() => {
                if (newRule.trim()) {
                  setRules([...rules, newRule.trim()]);
                  setNewRule('');
                }
              }}
              disabled={!newRule.trim()}
              className="rounded-lg bg-zinc-700 px-4 py-2 text-sm text-white hover:bg-zinc-600 disabled:opacity-50"
            >
              Add
            </button>
          </div>
        </div>

        {/* Tool Descriptions */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-6">
          <h2 className="mb-1 text-lg font-semibold text-white">Tool Descriptions</h2>
          <p className="mb-4 text-sm text-zinc-400">
            Customize descriptions for each AI tool. The AI reads these descriptions to understand what each tool does.
            Leave empty to use the default.
          </p>

          <div className="space-y-3">
            {DEFAULT_TOOLS.map((tool) => (
              <div key={tool.id} className="rounded-lg border border-zinc-800 bg-zinc-950 p-3">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-1.5 py-0.5 rounded">{tool.id}</span>
                  <span className="text-xs text-zinc-400">{tool.label}</span>
                </div>
                <textarea
                  value={toolDescs[tool.id] ?? tool.defaultDesc}
                  onChange={(e) => setToolDescs((prev) => ({ ...prev, [tool.id]: e.target.value }))}
                  rows={2}
                  className="w-full rounded-md border border-zinc-700 bg-zinc-800 px-3 py-1.5 text-xs text-white focus:border-blue-500 focus:outline-none resize-y"
                />
              </div>
            ))}
          </div>
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save AI Configuration'}
        </button>
      </div>
    </div>
  );
}
