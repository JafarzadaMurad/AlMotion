export interface OpenAIRequest {
    model: string;
    messages: Array<{ role: string; content: string | null; tool_calls?: any; tool_call_id?: string; name?: string }>;
    tools?: any[];
    tool_choice?: string;
}

function getAuthToken(): string | null {
    try {
        const stored = localStorage.getItem('auth-storage');
        if (stored) {
            const parsed = JSON.parse(stored);
            return parsed.state?.token ?? null;
        }
    } catch {
        // ignore
    }
    return null;
}

export class OpenAiService {
    // Same-origin Vite proxy path. Browser → /api/v1/openai/chat (port 5273)
    // → Vite rewrites to → backend /api/openai/chat (port 8000).
    // This avoids depending on the user having port 8000 forwarded locally.
    private static readonly API_URL = '/api/v1/openai/chat';

    constructor(private apiKey: string) { }

    async chat(messages: any[], tools: any[] = [], model = 'gpt-4o-mini', signal?: AbortSignal): Promise<any> {
        const token = getAuthToken();
        const response = await fetch(OpenAiService.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : { 'Authorization': `Bearer ${this.apiKey}` }),
            },
            body: JSON.stringify({
                model,
                messages,
                tools: tools.length > 0 ? tools : undefined,
                tool_choice: tools.length > 0 ? 'auto' : undefined,
            }),
            signal,
        });

        if (!response.ok) {
            const text = await response.text();
            let message = 'OpenAI API error';
            try {
                const data = JSON.parse(text);
                message = data.error?.message || data.message || (typeof data.error === 'string' ? data.error : null) || message;
            } catch { /* non-JSON response */ }
            throw new Error(message);
        }

        return response.json();
    }

    async runToolCompletion(messages: any[], tools: any[], model = 'gpt-4o-mini', signal?: AbortSignal): Promise<any> {
        const token = getAuthToken();
        const response = await fetch(OpenAiService.API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : { 'Authorization': `Bearer ${this.apiKey}` }),
            },
            body: JSON.stringify({
                model,
                messages,
                tools,
                tool_choice: 'auto',
            }),
            signal,
        });

        if (!response.ok) {
            const text = await response.text();
            let message = 'OpenAI API error';
            try {
                const data = JSON.parse(text);
                message = data.error?.message || data.message || (typeof data.error === 'string' ? data.error : null) || message;
            } catch { /* non-JSON response */ }
            throw new Error(message);
        }

        return response.json();
    }

    async transcribe(audioBlob: Blob): Promise<{ text: string, segments: Array<{ start: number, end: number, text: string }> }> {
        const formData = new FormData();
        formData.append('file', audioBlob, 'audio.mp4'); // Audio blob from video
        formData.append('model', 'whisper-1');
        formData.append('response_format', 'verbose_json');
        formData.append('timestamp_granularities[]', 'segment');

        const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.apiKey}`,
            },
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.error?.message || 'OpenAI Transcription error');
        }

        const data = await response.json();
        return {
            text: data.text,
            segments: data.segments.map((s: any) => ({
                start: s.start,
                end: s.end,
                text: s.text,
            })),
        };
    }
}
