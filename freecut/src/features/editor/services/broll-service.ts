import { OpenAiService } from '@/infrastructure/ai/openai-service';
import { PexelsService } from '@/infrastructure/external/pexels-service';
import { mediaLibraryService } from '@/features/media-library/services/media-library-service';
import { mediaTranscriptionService } from '@/features/media-library/services/media-transcription-service';
import { useTimelineStore } from '@/features/timeline/stores/timeline-store-facade';
import { useMediaLibraryStore } from '@/features/media-library/stores/media-library-store';
import { addItem } from '@/features/timeline/stores/timeline-actions';
import { createLogger } from '@/shared/logging/logger';
import type { VideoItem, TimelineTrack } from '@/types/timeline';
import { useAiChatStore } from '@/features/editor/stores/ai-chat-store';

const logger = createLogger('BrollService');

export interface BrollTask {
    keyword: string;
    start: number;
    end: number;
}

export class BrollService {
    constructor(
        private openai: OpenAiService,
        private pexels: PexelsService,
        private projectId: string
    ) { }

    async generateBrolls(mediaId: number | string): Promise<void> {
        const setStatus = useAiChatStore.getState().setInterimStatus;
        logger.info(`Starting B-roll generation for media ${mediaId}`);
        setStatus('Initializing B-roll generation...');

        // 1. Get the file and media info
        const blob = await mediaLibraryService.getMediaFile(String(mediaId));
        if (!blob) throw new Error('Video file not found');
        const media = await mediaLibraryService.getMedia(String(mediaId));
        if (!media) throw new Error('Media details not found');

        // Determine orientation
        let orientation: 'landscape' | 'portrait' | 'square' | undefined;
        if (media.width && media.height) {
            if (media.width > media.height) orientation = 'landscape';
            else if (media.width < media.height) orientation = 'portrait';
            else orientation = 'square';
        }

        // 2. Fetch transcript from db
        logger.info('Fetching existing transcript for B-rolls...');
        setStatus('Fetching transcript data...');
        const transcript = await mediaTranscriptionService.getTranscript(String(mediaId));
        if (!transcript) {
            throw new Error('Transcript not found. Please transcribe the media first.');
        }

        const timedText = transcript.segments.map(s => `[${s.start.toFixed(2)}-${s.end.toFixed(2)}] ${s.text}`).join('\n');

        // 3. Extract keywords via AI
        logger.info('Extracting keywords via AI...');
        setStatus('AI is analyzing transcript for B-roll opportunities...');
        const prompt = `You are a professional video editor assistant. Analyze the following transcript and identify segments where stock B-roll footage would enhance the video.
For each B-roll opportunity, provide an English search keyword and the time range (start, end in seconds).
Select maximum 5-7 most impactful segments.

IMPORTANT: Respond ONLY with a valid JSON array, no other text. Example format:
[{"keyword": "city traffic", "start": 10.5, "end": 15.0}]

Transcript:
${timedText}`;

        let aiResultText = '';
        try {
            const aiResponse = await this.openai.chat([
                { role: 'system', content: 'You are a professional video editor. Respond ONLY with a valid JSON array, nothing else.' },
                { role: 'user', content: prompt }
            ] as any[]);

            // Extract text content from OpenAI response object
            aiResultText = aiResponse?.choices?.[0]?.message?.content ?? '';
            logger.info('AI keyword response:', aiResultText);
        } catch (chatError) {
            logger.error('OpenAI chat call for keywords failed:', chatError);
            throw new Error(`Failed to get keywords from AI: ${chatError instanceof Error ? chatError.message : String(chatError)}`);
        }

        if (!aiResultText) {
            throw new Error('AI returned empty response for keyword extraction.');
        }

        setStatus('Parsing AI keyword suggestions...');

        let tasks: BrollTask[] = [];
        try {
            // Find JSON block in AI response
            const jsonMatch = aiResultText.match(/\[[\s\S]*\]/);
            if (jsonMatch) {
                tasks = JSON.parse(jsonMatch[0]);
            } else {
                logger.error('No JSON array found in response:', aiResultText);
                throw new Error('No valid JSON found');
            }
        } catch (e) {
            logger.error('Failed to parse AI keywords:', e);
            logger.error('Raw AI response was:', aiResultText);
            throw new Error(`Failed to parse keywords. AI response: ${aiResultText.substring(0, 200)}`);
        }

        if (tasks.length === 0) {
            logger.warn('No B-roll opportunities found');
            setStatus(null);
            return;
        }

        setStatus(`Found ${tasks.length} B-roll opportunities. Starting downloads...`);

        // 4. Create a new dedicated B-roll track
        const { tracks, fps } = useTimelineStore.getState();
        const maxOrder = tracks.reduce((max, t) => Math.max(max, t.order), 0);

        const brollTrack: TimelineTrack = {
            id: crypto.randomUUID(),
            name: 'B-Roll',
            kind: 'video',
            height: 80,
            locked: false,
            visible: true,
            muted: false,
            solo: false,
            order: maxOrder + 1,
            items: [],
        };

        // Add the new track to timeline
        const { setTracks } = await import('@/features/timeline/stores/actions/track-actions');
        setTracks([...tracks, brollTrack]);
        const targetTrackId = brollTrack.id;
        logger.info(`Created B-roll track: ${targetTrackId}`);

        // 5. For each task, search Pexels, download, and place at correct timestamp
        let successCount = 0;
        for (const task of tasks) {
            try {
                logger.info(`Searching Pexels for: ${task.keyword}`);
                setStatus(`Searching Pexels for: "${task.keyword}"...`);
                const pexelsResult = await this.pexels.searchVideos(task.keyword, 1, orientation);
                if (pexelsResult.videos.length === 0) {
                    setStatus(`No results found for "${task.keyword}". Skipping.`);
                    await new Promise(r => setTimeout(r, 1000));
                    continue;
                }
                setStatus(`Found match for "${task.keyword}". Downloading...`);

                const pexelsVideo = pexelsResult.videos[0];
                if (!pexelsVideo) continue;

                const videoFile = pexelsVideo.video_files.find(f => f.quality === 'hd') || pexelsVideo.video_files[0];
                if (!videoFile) continue;

                logger.info(`Downloading B-roll: ${task.keyword}`);
                setStatus(`Downloading B-roll: "${task.keyword}"...`);
                const videoBlob = await fetch(videoFile.link).then(r => r.blob());

                logger.info(`Importing B-roll into project...`);
                setStatus(`Importing "${task.keyword}" into timeline at ${task.start.toFixed(1)}s...`);
                const metadata = await mediaLibraryService.importMediaBlob(
                    videoBlob,
                    `${task.keyword.replace(/\s+/g, '_')}.mp4`,
                    this.projectId,
                    { tags: ['b-roll', task.keyword] }
                );

                // Place at exact timestamp from transcript analysis
                const startFrame = Math.round(task.start * fps);
                const durationFrames = Math.round((task.end - task.start) * fps);

                const videoItem: VideoItem = {
                    id: crypto.randomUUID(),
                    type: 'video',
                    trackId: targetTrackId,
                    from: startFrame,
                    durationInFrames: durationFrames,
                    label: `B-Roll: ${task.keyword}`,
                    mediaId: metadata.id,
                    src: '',
                    sourceDuration: Math.round((metadata.duration || 0) * fps),
                    sourceWidth: metadata.width || 1920,
                    sourceHeight: metadata.height || 1080,
                    trimStart: 0,
                    trimEnd: 0,
                };

                logger.info(`Adding B-roll "${task.keyword}" at frame ${startFrame} (${task.start.toFixed(1)}s - ${task.end.toFixed(1)}s)`);
                addItem(videoItem);
                successCount++;

                useMediaLibraryStore.getState().loadMediaItems();
            } catch (e: any) {
                logger.error(`Failed to process B-roll for ${task.keyword}`, e);
            }
        }

        setStatus(null);
        logger.info(`B-roll generation completed. ${successCount}/${tasks.length} clips added.`);
        if (successCount === 0) throw new Error('Could not add any B-roll clips. Please try again.');
    }

    async replaceBroll(itemId: string): Promise<void> {
        const setStatus = useAiChatStore.getState().setInterimStatus;
        logger.info(`Starting replace B-roll for item ${itemId}`);
        setStatus('Initializing B-roll replacement...');

        const { items, fps } = useTimelineStore.getState();
        const existingItem = items.find(i => i.id === itemId);
        if (!existingItem || existingItem.type !== 'video' || !existingItem.label?.startsWith('B-Roll:')) {
            throw new Error('Mövcud B-roll klipi tapılmadı. Zəhmət olmasa düzgün elementi seçin.');
        }

        const keyword = existingItem.label.replace('B-Roll:', '').trim();
        if (!keyword) {
            throw new Error('Açar söz tapılmadı.');
        }

        setStatus(`Searching alternative for "${keyword}"...`);
        // Use a random page to get a different result (1 to 5)
        const randomPage = Math.floor(Math.random() * 5) + 1;
        const pexelsResult = await this.pexels.searchVideos(keyword, 1, undefined, randomPage);

        if (pexelsResult.videos.length === 0) {
            throw new Error(`Yeni B-roll tapılmadı "${keyword}" üçün.`);
        }

        const pexelsVideo = pexelsResult.videos[0];
        if (!pexelsVideo) throw new Error('Video tapılmadı');

        const videoFile = pexelsVideo.video_files.find(f => f.quality === 'hd') || pexelsVideo.video_files[0];
        if (!videoFile) throw new Error('Video faylı tapılmadı');

        setStatus(`Downloading new B-roll: "${keyword}"...`);
        const videoBlob = await fetch(videoFile.link).then(r => r.blob());

        setStatus(`Importing new B-roll into timeline...`);
        const metadata = await mediaLibraryService.importMediaBlob(
            videoBlob,
            `${keyword.replace(/\s+/g, '_')}_alt.mp4`,
            this.projectId,
            { tags: ['b-roll', keyword] }
        );

        const videoItem: VideoItem = {
            ...existingItem,
            id: crypto.randomUUID(), // New ID
            mediaId: metadata.id,
            sourceDuration: Math.round((metadata.duration || 0) * fps),
            sourceWidth: metadata.width || 1920,
            sourceHeight: metadata.height || 1080,
            trimStart: 0,
            trimEnd: 0,
        };

        const { removeItems } = await import('@/features/timeline/stores/actions/item-actions');
        const { addItem } = await import('@/features/timeline/stores/timeline-actions');

        // Remove old and add new
        removeItems([existingItem.id]);
        addItem(videoItem);

        useMediaLibraryStore.getState().loadMediaItems();
        setStatus(null);
        logger.info(`Successfully replaced B-roll for ${keyword}`);
    }
}
