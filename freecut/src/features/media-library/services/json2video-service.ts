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

export class Json2VideoService {
    // Backend proxies these requests to the json2video server, so we go
    // through the same `/api/v1` prefix as the rest of the app and rely on
    // the user's auth token rather than a shared X-API-Key.
    private readonly baseUrl = '/api/v1';

    /**
     * Start a transcription job and return the job_id
     */
    async startTranscription(file: Blob, language?: string): Promise<string> {
        const formData = new FormData();
        formData.append('file', file, file.type.includes('video') ? 'video.mp4' : 'audio.mp3');
        if (language) {
            formData.append('language', language);
        }

        const token = getAuthToken();
        const response = await fetch(`${this.baseUrl}/transcribe`, {
            method: 'POST',
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(`Failed to start transcription: ${response.statusText} - ${errorData.error || ''}`);
        }

        const data = await response.json();
        return data.job_id;
    }

    /**
     * Poll job status until complete
     */
    async pollJobStatus(jobId: string, onProgress?: (msg: string) => void): Promise<{ srtUrl: string }> {
        const maxRetries = 120; // 4 minutes max
        const intervalMs = 2000;

        for (let i = 0; i < maxRetries; i++) {
            const token = getAuthToken();
            const response = await fetch(`${this.baseUrl}/transcribe/${jobId}`, {
                headers: {
                    Accept: 'application/json',
                    ...(token ? { Authorization: `Bearer ${token}` } : {}),
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to check job status: ${response.statusText}`);
            }

            const data = await response.json();

            if (data.status === 'done') {
                if (onProgress) onProgress('Tamamlandı');
                return { srtUrl: data.srt_url };
            }

            if (data.status === 'failed' || data.status === 'error') {
                throw new Error(data.error || 'Transcription job failed.');
            }

            if (onProgress) {
                if (data.status === 'queued') onProgress('Növbədə gözləyir...');
                if (data.status === 'processing') onProgress('Transkripsiya edilir...');
            }

            await new Promise(resolve => setTimeout(resolve, intervalMs));
        }

        throw new Error('Transcription job timed out.');
    }

    /**
     * Fetch SRT content from the srt_url
     */
    async downloadSrt(srtUrl: string): Promise<string> {
        // Rewrite to use vite proxy to avoid CORS issues
        const proxiedUrl = srtUrl.replace('http://168.231.108.200:2993', '');
        const response = await fetch(proxiedUrl);
        if (!response.ok) {
            throw new Error(`Failed to download SRT file`);
        }
        return await response.text();
    }

    /**
     * Helper to parse downloaded SRT format.
     */
    parseSrtToSegments(srt: string): { text: string; start: number; end: number }[] {
        const blocks = srt.trim().split(/\n\s*\n/);
        const segments: { text: string; start: number; end: number }[] = [];
        for (const block of blocks) {
            const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
            if (lines.length >= 2) {
                const timeLineIndex = lines.findIndex(l => l.includes('-->') || l.includes('->'));
                if (timeLineIndex !== -1) {
                    const timeStr = lines[timeLineIndex];
                    if (!timeStr) continue;
                    const text = lines.slice(timeLineIndex + 1).join(' ').trim();
                    const [startStr, endStr] = timeStr.split(/--?>/);
                    const parseTime = (t: string | undefined) => {
                        if (!t) return 0;
                        const parts = t.trim().split(':');
                        if (parts.length !== 3) return 0;
                        const secMs = parts[2];
                        if (!secMs) return 0;
                        const [sec, ms] = (secMs.includes(',') ? secMs.split(',') : secMs.split('.'));
                        return parseFloat(parts[0] || '0') * 3600 + parseFloat(parts[1] || '0') * 60 + parseFloat(sec || '0') + (parseFloat(ms || '0') / 1000);
                    };
                    if (startStr && endStr && text) {
                        try {
                            segments.push({
                                text,
                                start: parseTime(startStr),
                                end: parseTime(endStr)
                            });
                        } catch (err) { }
                    }
                }
            }
        }
        return segments;
    }
}

// Singleton — the json2video API key now lives in the backend.
export const json2VideoService = new Json2VideoService();
