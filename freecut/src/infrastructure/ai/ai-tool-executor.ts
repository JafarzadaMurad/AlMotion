import { useTimelineStore } from '@/features/editor/deps/timeline-store';
import { useAiChatStore } from '@/features/editor/stores/ai-chat-store';
import { usePlaybackStore } from '@/shared/state/playback';
import { useSelectionStore } from '@/shared/state/selection';
import {
    splitItem,
    removeItems,
    moveItems,
    addItem,
    updateItem,
} from '@/features/timeline/stores/timeline-actions';
import { updateItemTransform } from '@/features/timeline/stores/actions/transform-actions';
import {
    createDefaultTextItem,
    findCompatibleTrackForItemType,
    findNearestAvailableSpace,
    getDefaultGeneratedLayerDurationInFrames,
} from '@/features/editor/deps/timeline-utils';
import { useProjectStore } from '@/features/editor/deps/projects';
import { useMediaLibraryStore } from '@/features/media-library/stores/media-library-store';
import { PexelsService } from '../external/pexels-service';
import { mediaLibraryService } from '@/features/media-library/services/media-library-service';
import { mediaTranscriptionService } from '@/features/media-library/services/media-transcription-service';
import { getMediaType } from '@/features/media-library/utils/validation';
import { ApiClient } from '@/infrastructure/api/api-client';

export class AiToolExecutor {
    private pexelsApiKey: string | null = null;

    setApiKeys(_openai: string | null, pexels: string | null) {
        this.pexelsApiKey = pexels;
    }
    async execute(toolCall: any): Promise<string> {
        const { name, arguments: argsString } = toolCall.function;
        const args = JSON.parse(argsString);

        switch (name) {
            case 'get_timeline_info':
                return this.getTimelineInfo();
            case 'split_selected_clips':
                return this.splitSelectedClips(args.frame);
            case 'delete_selected_items':
                return this.deleteSelectedItems();
            case 'move_selected_items':
                return this.moveSelectedItems(args.deltaFrames);
            case 'add_text_item':
                return this.addTextItem(args);
            case 'search_pexels_videos':
                return this.searchPexelsVideos(args.query);
            case 'search_and_import_pexels':
                return await this.searchAndImportPexels(args.query, args.orientation);
            case 'add_clip_to_timeline':
                return await this.addClipToTimeline(args.mediaId, args.targetTrackId, args.startTimeSec, args.durationSec);
            case 'transcribe_media':
                return await this.transcribeMedia(args.mediaId);
            case 'add_captions':
                return await this.addCaptions(args.mediaId, args.clipId);
            case 'get_media_library_info':
                return await this.getMediaLibraryInfo();
            case 'get_media_transcript':
                return await this.getMediaTranscript(args.mediaId);
            case 'generate_ai_broll':
                return await this.generateAiBroll(args.prompt, args.duration, args.aspect_ratio);
            case 'list_heygen_avatars':
                return await this.listHeygenAvatars(args.ownership);
            case 'list_heygen_voices':
                return await this.listHeygenVoices(args.language, args.gender);
            case 'show_picker':
                return await this.showPicker(args.picker_type, args.items);
            case 'generate_avatar_video':
                return await this.generateAvatarVideo(args.script, args.avatar_id, args.voice_id);
            case 'capture_current_frame':
                return await this.captureCurrentFrame();
            case 'capture_video_frames':
                return await this.captureVideoFrames(args.timestamps);
            case 'update_item_style':
                return this.updateItemStyle(args.itemIds, args.properties);
            case 'remove_items':
                return this.removeItemsById(args.itemIds);
            case 'cut_time_range':
                return this.cutTimeRange(args.itemId, args.startSec, args.endSec);
            case 'select_items_by_id':
                return this.selectItemsById(args.itemIds);
            case 'move_items_by_id':
                return this.moveItemsById(args.itemIds, args.deltaFrames);
            case 'ask_user':
                return this.askUser(args.question, args.options);
            case 'send_chat_message':
                return this.sendChatMessage(args.message);
            default:
                return `Unknown tool: ${name}`;
        }
    }

    private getTimelineInfo(): string {
        const { items, tracks, fps } = useTimelineStore.getState();
        const { selectedItemIds } = useSelectionStore.getState();
        const { currentFrame } = usePlaybackStore.getState();

        return JSON.stringify({
            currentFrame,
            fps,
            totalTracks: tracks.length,
            selectedItemIds,
            tracks: tracks
                .sort((a, b) => a.order - b.order)
                .map(t => {
                    const trackItems = items.filter(i => i.trackId === t.id);
                    const itemTypes = [...new Set(trackItems.map(i => i.type))];
                    const hasCaptions = trackItems.some(i => i.type === 'text' && (i as any).captionSource);
                    return {
                        id: t.id,
                        name: t.name,
                        kind: t.kind,
                        order: t.order,
                        itemCount: trackItems.length,
                        itemTypes,
                        hasCaptions,
                    };
                }),
            allTimelineItems: items.map(i => ({
                id: i.id,
                label: i.label,
                type: i.type,
                from: i.from,
                duration: i.durationInFrames,
                trackId: i.trackId,
                mediaId: (i as any).mediaId,
                ...(i.type === 'text' ? {
                    color: (i as any).color,
                    fontSize: (i as any).fontSize,
                    fontFamily: (i as any).fontFamily,
                    isCaption: !!(i as any).captionSource,
                } : {}),
            })),
        });
    }

    private splitSelectedClips(frame?: number): string {
        const { selectedItemIds } = useSelectionStore.getState();
        const splitAt = frame ?? usePlaybackStore.getState().currentFrame;

        if (selectedItemIds.length === 0) {
            return 'No items selected to split.';
        }

        let splitCount = 0;
        selectedItemIds.forEach(id => {
            try {
                splitItem(id, splitAt);
                splitCount++;
            } catch (e) {
                // Skip if split fails for this item
            }
        });

        return `Successfully split ${splitCount} items at frame ${splitAt}.`;
    }

    private deleteSelectedItems(): string {
        const { selectedItemIds } = useSelectionStore.getState();
        if (selectedItemIds.length === 0) {
            return 'No items selected to delete.';
        }

        removeItems(selectedItemIds);
        return `Deleted ${selectedItemIds.length} items.`;
    }

    private moveSelectedItems(deltaFrames: number): string {
        const { items } = useTimelineStore.getState();
        const { selectedItemIds } = useSelectionStore.getState();

        if (selectedItemIds.length === 0) {
            return 'No items selected to move.';
        }

        const updates = selectedItemIds.map(id => {
            const item = items.find(i => i.id === id);
            if (!item) return null;
            return { id, from: item.from + deltaFrames };
        }).filter((u): u is { id: string, from: number } => u !== null);

        moveItems(updates);
        return `Moved ${updates.length} items by ${deltaFrames} frames.`;
    }

    private addTextItem(args: {
        text: string;
        startTimeSec?: number;
        durationSec?: number;
        color?: string;
        backgroundColor?: string;
        fontSize?: number;
        fontFamily?: string;
        fontWeight?: string;
        positionY?: number;
        positionX?: number;
    }): string {
        const { tracks, items, fps } = useTimelineStore.getState();
        const { activeTrackId, selectItems } = useSelectionStore.getState();
        const currentProject = useProjectStore.getState().currentProject;

        const targetTrack = findCompatibleTrackForItemType({
            tracks,
            items,
            itemType: 'text',
            preferredTrackId: activeTrackId,
        });

        if (!targetTrack) {
            return 'No available track for text item.';
        }

        const durationInFrames = args.durationSec
            ? Math.round(args.durationSec * fps)
            : getDefaultGeneratedLayerDurationInFrames(fps);

        const proposedPosition = args.startTimeSec !== undefined
            ? Math.round(args.startTimeSec * fps)
            : usePlaybackStore.getState().currentFrame;

        const finalPosition = findNearestAvailableSpace(
            proposedPosition,
            durationInFrames,
            targetTrack.id,
            items
        ) ?? proposedPosition;

        const canvasWidth = currentProject?.metadata.width ?? 1920;
        const canvasHeight = currentProject?.metadata.height ?? 1080;

        const textItem = createDefaultTextItem({
            trackId: targetTrack.id,
            from: finalPosition,
            durationInFrames,
            canvasWidth,
            canvasHeight,
        });

        // Apply text content
        (textItem as any).text = args.text;
        textItem.label = args.text.split('\n')[0]?.slice(0, 48) || 'Text';

        // Apply styling
        if (args.color) (textItem as any).color = args.color;
        if (args.backgroundColor) (textItem as any).backgroundColor = args.backgroundColor;
        if (args.fontSize) (textItem as any).fontSize = args.fontSize;
        if (args.fontFamily) (textItem as any).fontFamily = args.fontFamily;
        if (args.fontWeight) (textItem as any).fontWeight = args.fontWeight;

        // Apply position
        if (args.positionY !== undefined || args.positionX !== undefined) {
            const transform = (textItem as any).transform || {};
            if (args.positionY !== undefined) {
                transform.y = ((args.positionY - 50) / 100) * canvasHeight;
            }
            if (args.positionX !== undefined) {
                transform.x = ((args.positionX - 50) / 100) * canvasWidth;
            }
            (textItem as any).transform = transform;
        }

        addItem(textItem);
        selectItems([textItem.id]);

        return JSON.stringify({
            success: true,
            itemId: textItem.id,
            text: args.text,
            fromFrame: finalPosition,
            startTimeSec: +(finalPosition / fps).toFixed(2),
        });
    }

    private async getMediaLibraryInfo(): Promise<string> {
        const { mediaItems, transcriptStatus } = useMediaLibraryStore.getState();

        // Find which media have transcripts
        const transcriptIds = await mediaTranscriptionService.getTranscriptMediaIds(mediaItems.map(i => i.id));
        const transcriptIdSet = new Set(transcriptIds);

        return JSON.stringify({
            totalMediaItems: mediaItems.length,
            items: mediaItems.map((i: any) => ({
                id: i.id,
                fileName: i.fileName,
                mimeType: i.mimeType,
                duration: i.duration,
                width: i.width,
                height: i.height,
                hasTranscript: transcriptIdSet.has(i.id),
                transcriptStatus: transcriptStatus.get(i.id) ?? 'idle',
                isAiBroll: i.tags?.includes('ai-broll') ?? false,
                tags: i.tags ?? [],
            })),
        });
    }

    private async getMediaTranscript(mediaId: string): Promise<string> {
        try {
            mediaId = this.resolveMediaId(mediaId);
            const transcript = await mediaTranscriptionService.getTranscript(mediaId);
            if (!transcript) {
                return JSON.stringify({ error: `No transcript found for media ID: ${mediaId}. Make sure it has been generated first.` });
            }
            return JSON.stringify({
                mediaId: transcript.mediaId,
                language: transcript.language,
                text: transcript.text,
                segments: transcript.segments.map(s => ({
                    start: s.start,
                    end: s.end,
                    text: s.text
                }))
            });
        } catch (error) {
            return JSON.stringify({ error: `Failed to retrieve transcript: ${error instanceof Error ? error.message : String(error)}` });
        }
    }

    private selectItemsById(itemIds: string[]): string {
        const { selectItems } = useSelectionStore.getState();
        selectItems(itemIds);
        return `Selected ${itemIds.length} items.`;
    }

    private moveItemsById(itemIds: string[], deltaFrames: number): string {
        const { items } = useTimelineStore.getState();
        const updates = itemIds.map(id => {
            const item = items.find(i => i.id === id);
            if (!item) return null;
            return { id, from: item.from + deltaFrames };
        }).filter((u): u is { id: string, from: number } => u !== null);

        if (updates.length === 0) return 'No valid items found to move.';

        moveItems(updates);
        return `Moved ${updates.length} items by ${deltaFrames} frames.`;
    }

    private async searchPexelsVideos(query: string): Promise<string> {
        if (!this.pexelsApiKey) return 'Pexels API açarı daxil edilməyib.';
        const service = new PexelsService(this.pexelsApiKey);
        try {
            const results = await service.searchVideos(query, 3);
            if (results.videos.length === 0) return `"${query}" üçün video tapılmadı.`;
            return `"${query}" üçün ${results.videos.length} video tapıldı: ` +
                results.videos.map(v => v.url).join(', ');
        } catch (e) {
            return `Pexels xətası: ${e instanceof Error ? e.message : String(e)}`;
        }
    }

    private resolveMediaId(input: string): string {
        // If input looks like a UUID, return as-is
        if (/^[0-9a-f-]{36}$/i.test(input)) return input;
        // Otherwise try to find by filename
        const { mediaItems } = useMediaLibraryStore.getState();
        const match = mediaItems.find(m => m.fileName === input || m.fileName.includes(input));
        if (match) return match.id;
        return input; // return original, will fail with "not found" which is clearer
    }

    private async transcribeMedia(mediaId: string): Promise<string> {
        try {
            mediaId = this.resolveMediaId(mediaId);
            // Check if transcript already exists — avoid redundant API call
            const existing = await mediaTranscriptionService.getTranscript(mediaId);
            if (existing) {
                return JSON.stringify({
                    success: true,
                    cached: true,
                    message: 'Transcript already exists for this media. No need to re-transcribe. Use get_media_transcript to read it.',
                    transcriptId: existing.id,
                    segmentCount: existing.segments.length,
                });
            }

            console.log('[AI Tool] transcribeMedia: starting transcription for', mediaId);
            const transcript = await mediaTranscriptionService.transcribeMedia(mediaId);
            console.log('[AI Tool] transcribeMedia: completed, segments:', transcript.segments.length);
            return JSON.stringify({ success: true, message: 'Transcription completed successfully.', transcriptId: transcript.id });
        } catch (e) {
            const errMsg = e instanceof Error ? e.message : String(e);
            console.error('[AI Tool] transcribeMedia FAILED:', errMsg);
            return JSON.stringify({ error: `Transcription failed: ${errMsg}. Do NOT retry — inform the user about the error.` });
        }
    }

    private async addCaptions(mediaId: string, clipId?: string): Promise<string> {
        try {
            mediaId = this.resolveMediaId(mediaId);
            const result = await mediaTranscriptionService.insertTranscriptAsCaptions(
                mediaId,
                {
                    replaceExisting: true,
                    ...(clipId ? { clipIds: [clipId] } : {}),
                },
            );
            return JSON.stringify({ success: true, insertedItemCount: result.insertedItemCount, removedItemCount: result.removedItemCount });
        } catch (e) {
            // Surface a hint when the failure is the multi-clip ambiguity case so the
            // AI knows to call get_timeline_info and retry with an explicit clipId.
            const msg = e instanceof Error ? e.message : String(e);
            if (/does not overlap|Select a clip/i.test(msg)) {
                return JSON.stringify({
                    error: `${msg}. Multiple clips may share this mediaId (e.g. a primary clip plus B-roll reuse). Call get_timeline_info, find the clip with the longest durationInFrames for this mediaId (that is the primary audio source), and retry add_captions with that clip's id passed as clipId.`,
                });
            }
            return JSON.stringify({ error: msg });
        }
    }

    private async askUser(question: string, options?: string[]): Promise<string> {
        // Show the question as an assistant message
        useAiChatStore.getState().addSessionMessage({ role: 'assistant', content: question });

        // Pause the tool loop — wait for user to respond
        return new Promise<string>((resolve) => {
            useAiChatStore.getState().setPendingUserInput({
                question,
                options: options ?? null,
                pickerType: null,
                pickerItems: null,
                resolve: (answer: string) => {
                    resolve(JSON.stringify({ user_response: answer }));
                },
            });
        });
    }

    private async sendChatMessage(message: string): Promise<string> {
        useAiChatStore.getState().addSessionMessage({ role: 'assistant', content: message });
        return JSON.stringify({ success: true });
    }

    private async searchAndImportPexels(query: string, orientation?: 'landscape' | 'portrait' | 'square'): Promise<string> {
        if (!this.pexelsApiKey) return JSON.stringify({ error: 'Pexels API key is not configured.' });
        const currentProject = useProjectStore.getState().currentProject;
        if (!currentProject) return JSON.stringify({ error: 'No project selected.' });

        let calculatedOrientation = orientation;
        if (!calculatedOrientation) {
            const width = currentProject.metadata.width || 1920;
            const height = currentProject.metadata.height || 1080;
            if (Math.abs(width - height) < 100) calculatedOrientation = 'square';
            else if (width > height) calculatedOrientation = 'landscape';
            else calculatedOrientation = 'portrait';
        }

        try {
            const pexels = new PexelsService(this.pexelsApiKey);
            const randomPage = Math.floor(Math.random() * 5) + 1;
            const pexelsResult = await pexels.searchVideos(query, 1, calculatedOrientation, randomPage);

            if (pexelsResult.videos.length === 0) {
                return JSON.stringify({ error: `No Pexels results found for keyword: ${query}` });
            }

            const pexelsVideo = pexelsResult.videos[0];
            if (!pexelsVideo) return JSON.stringify({ error: 'No video found.' });
            const videoFile = pexelsVideo.video_files.find(f => f.quality === 'hd') || pexelsVideo.video_files[0];
            if (!videoFile) return JSON.stringify({ error: 'No video file format found in Pexels result.' });

            const videoBlob = await fetch(videoFile.link).then(r => r.blob());

            const metadata = await mediaLibraryService.importMediaBlob(
                videoBlob,
                `${query.replace(/\s+/g, '_')}_${Date.now()}.mp4`,
                currentProject.id,
                { tags: ['b-roll', query] }
            );

            useMediaLibraryStore.getState().loadMediaItems();

            return JSON.stringify({
                success: true,
                mediaId: metadata.id,
                width: metadata.width,
                height: metadata.height,
                durationSec: metadata.duration
            });
        } catch (e) {
            return JSON.stringify({ error: `Pexels search/import failed: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private async captureCurrentFrame(): Promise<string> {
        // If a video item is selected, capture from its source at current playhead time
        const { selectedItemIds } = useSelectionStore.getState();
        const { items } = useTimelineStore.getState();
        const fps = useTimelineStore.getState().fps || 30;
        const currentFrame = usePlaybackStore.getState().currentFrame;
        const currentTimeSec = currentFrame / fps;

        const selectedVideoItem = selectedItemIds.length > 0
            ? items.find(i => selectedItemIds.includes(i.id) && i.type === 'video')
            : null;

        if (selectedVideoItem) {
            const mediaId = (selectedVideoItem as any).mediaId;
            if (mediaId) {
                // Calculate source-relative time
                const itemStartSec = selectedVideoItem.from / fps;
                const sourceTimeSec = Math.max(0, currentTimeSec - itemStartSec);
                return this.captureFramesFromSource(mediaId, [sourceTimeSec]);
            }
        }

        // Fallback: capture from preview canvas
        const { captureFrame } = usePlaybackStore.getState();
        if (!captureFrame) {
            return JSON.stringify({ error: 'Preview is not available. Make sure the editor is open with a video on the timeline.' });
        }

        try {
            const dataUrl = await captureFrame({ width: 1024, format: 'image/png' });
            if (!dataUrl) {
                return JSON.stringify({ error: 'Failed to capture frame — no image returned.' });
            }
            console.log('[AI Vision] captureCurrentFrame: preview canvas, length:', dataUrl.length);
            return JSON.stringify({
                type: 'vision_frames',
                frames: [{ timestamp: currentTimeSec, dataUrl }],
            });
        } catch (e) {
            return JSON.stringify({ error: `Capture failed: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private async captureVideoFrames(timestamps: number[]): Promise<string> {
        // Try to find selected video/audio item's source media
        const { selectedItemIds } = useSelectionStore.getState();
        const { items } = useTimelineStore.getState();

        console.log('[AI Vision] captureVideoFrames: selectedItemIds:', selectedItemIds, 'total items:', items.length);

        const selectedItem = selectedItemIds.length > 0
            ? items.find(i => selectedItemIds.includes(i.id) && (i.type === 'video' || i.type === 'audio'))
            : items.find(i => i.type === 'video');

        console.log('[AI Vision] selectedItem:', selectedItem?.id, 'type:', selectedItem?.type, 'mediaId:', (selectedItem as any)?.mediaId);

        const mediaId = (selectedItem as any)?.mediaId;

        if (mediaId) {
            // Extract frames directly from source media file (not composed preview)
            return this.captureFramesFromSource(mediaId, timestamps);
        }

        console.log('[AI Vision] No mediaId found, falling back to preview canvas');
        // Fallback: capture from preview canvas
        return this.captureFramesFromPreview(timestamps);
    }

    private async captureFramesFromSource(mediaId: string, timestamps: number[]): Promise<string> {
        const limited = timestamps.slice(0, 6);

        try {
            const blobUrl = await mediaLibraryService.getMediaBlobUrl(mediaId);
            if (!blobUrl) {
                return JSON.stringify({ error: 'Could not load source media file.' });
            }

            const video = document.createElement('video');
            video.crossOrigin = 'anonymous';
            video.muted = true;
            video.preload = 'auto';
            video.src = blobUrl;

            await new Promise<void>((resolve, reject) => {
                video.onloadeddata = () => resolve();
                video.onerror = () => reject(new Error('Failed to load video'));
                setTimeout(() => reject(new Error('Video load timeout')), 10000);
            });

            const canvas = document.createElement('canvas');
            const targetWidth = 1024;
            const scale = targetWidth / video.videoWidth;
            canvas.width = targetWidth;
            canvas.height = Math.round(video.videoHeight * scale);
            const ctx = canvas.getContext('2d')!;

            const frames: Array<{ timestamp: number; dataUrl: string }> = [];

            for (const ts of limited) {
                video.currentTime = Math.min(ts, video.duration - 0.1);
                await new Promise<void>((resolve) => {
                    video.onseeked = () => resolve();
                    setTimeout(() => resolve(), 2000);
                });
                ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
                const dataUrl = canvas.toDataURL('image/png');
                frames.push({ timestamp: ts, dataUrl });
            }

            // Cleanup
            video.src = '';
            video.load();

            if (frames.length === 0) {
                return JSON.stringify({ error: 'No frames could be captured from source.' });
            }

            console.log(`[AI Vision] captureFromSource: ${frames.length} frames from media ${mediaId}`);
            return JSON.stringify({ type: 'vision_frames', frames });
        } catch (e) {
            return JSON.stringify({ error: `Source capture failed: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private async captureFramesFromPreview(timestamps: number[]): Promise<string> {
        const { captureFrame, setCurrentFrame } = usePlaybackStore.getState();
        const fps = useTimelineStore.getState().fps || 30;

        if (!captureFrame) {
            return JSON.stringify({ error: 'Preview is not available.' });
        }

        const limited = timestamps.slice(0, 6);
        const originalFrame = usePlaybackStore.getState().currentFrame;
        const frames: Array<{ timestamp: number; dataUrl: string }> = [];

        try {
            for (const ts of limited) {
                const frame = Math.round(ts * fps);
                setCurrentFrame(frame);
                await new Promise(r => setTimeout(r, 200));
                const dataUrl = await captureFrame({ width: 1024, format: 'image/png' });
                if (dataUrl) {
                    frames.push({ timestamp: ts, dataUrl });
                }
            }
            setCurrentFrame(originalFrame);

            if (frames.length === 0) {
                return JSON.stringify({ error: 'No frames could be captured.' });
            }

            return JSON.stringify({ type: 'vision_frames', frames });
        } catch (e) {
            setCurrentFrame(originalFrame);
            return JSON.stringify({ error: `Capture failed: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private updateItemStyle(itemIds: string[], properties: Record<string, any>): string {
        const { items } = useTimelineStore.getState();
        let updatedCount = 0;

        for (const id of itemIds) {
            const item = items.find(i => i.id === id);
            if (!item || item.type !== 'text') continue;

            const updates: Record<string, any> = {};
            if (properties.text !== undefined) {
                updates.text = properties.text;
                updates.label = properties.text.split('\n')[0]?.slice(0, 48) || 'Text';
            }
            if (properties.color !== undefined) updates.color = properties.color;
            if (properties.backgroundColor !== undefined) updates.backgroundColor = properties.backgroundColor;
            if (properties.fontSize !== undefined) updates.fontSize = properties.fontSize;
            if (properties.fontFamily !== undefined) updates.fontFamily = properties.fontFamily;
            if (properties.fontWeight !== undefined) updates.fontWeight = properties.fontWeight;
            if (properties.fontStyle !== undefined) updates.fontStyle = properties.fontStyle;
            if (properties.textAlign !== undefined) updates.textAlign = properties.textAlign;
            if (properties.lineHeight !== undefined) updates.lineHeight = properties.lineHeight;
            if (properties.letterSpacing !== undefined) updates.letterSpacing = properties.letterSpacing;
            if (properties.stroke !== undefined) updates.stroke = properties.stroke;
            if (properties.textShadow !== undefined) updates.textShadow = properties.textShadow;

            if (Object.keys(updates).length > 0) {
                updateItem(id, updates);
                updatedCount++;
            }

            // Handle position changes via transform
            const currentProject = useProjectStore.getState().currentProject;
            const canvasWidth = currentProject?.metadata.width ?? 1920;
            const canvasHeight = currentProject?.metadata.height ?? 1080;
            const transformUpdates: Record<string, number> = {};

            if (properties.positionY !== undefined) {
                // Convert percentage (0=top, 50=center, 100=bottom) to pixel offset from center
                transformUpdates.y = ((properties.positionY - 50) / 100) * canvasHeight;
            }
            if (properties.positionX !== undefined) {
                transformUpdates.x = ((properties.positionX - 50) / 100) * canvasWidth;
            }
            if (properties.opacity !== undefined) {
                transformUpdates.opacity = properties.opacity;
            }

            if (Object.keys(transformUpdates).length > 0) {
                updateItemTransform(id, transformUpdates);
                if (Object.keys(updates).length === 0) updatedCount++;
            }
        }

        return updatedCount > 0
            ? `Updated style of ${updatedCount} item(s).`
            : 'No matching text items found to update.';
    }

    private async generateAiBroll(prompt: string, duration?: number, aspectRatio?: string): Promise<string> {
        const currentProject = useProjectStore.getState().currentProject;
        if (!currentProject) return JSON.stringify({ error: 'No project open.' });

        // Auto-detect aspect ratio from project if not specified
        if (!aspectRatio) {
            const w = currentProject.metadata.width || 1920;
            const h = currentProject.metadata.height || 1080;
            const ratio = w / h;
            if (Math.abs(ratio - 16 / 9) < 0.1) aspectRatio = '16:9';
            else if (Math.abs(ratio - 9 / 16) < 0.1) aspectRatio = '9:16';
            else if (Math.abs(ratio - 4 / 3) < 0.1) aspectRatio = '4:3';
            else if (Math.abs(ratio - 1) < 0.1) aspectRatio = '1:1';
            else if (Math.abs(ratio - 3 / 4) < 0.1) aspectRatio = '3:4';
            else aspectRatio = '16:9';
        }

        try {
            // Step 1: Submit generation request
            const submitResponse = await ApiClient.post<any>('/wavespeed/generate', {
                prompt,
                duration: duration ?? 5,
                aspect_ratio: aspectRatio,
                resolution: '480p',
            });

            console.log('[AI Tool] generateAiBroll: submit raw response:', JSON.stringify(submitResponse).slice(0, 500));

            const requestId = submitResponse?.data?.id || submitResponse?.id;
            if (!requestId) {
                return JSON.stringify({ error: 'No request ID returned from WaveSpeed.', response: submitResponse });
            }

            console.log('[AI Tool] generateAiBroll: job submitted, requestId:', requestId);

            // Step 2: Poll for result
            const maxRetries = 120;
            const intervalMs = 3000;

            for (let i = 0; i < maxRetries; i++) {
                await new Promise(r => setTimeout(r, intervalMs));

                const statusResponse = await ApiClient.get<any>(`/wavespeed/status/${requestId}`);
                const data = statusResponse?.data || statusResponse;

                console.log(`[AI Tool] generateAiBroll: poll #${i + 1}, status: ${data?.status}, outputs: ${JSON.stringify(data?.outputs?.slice(0, 1))}`);

                if (data?.status === 'completed' || data?.status === 'succeeded') {
                    const videoUrl = data.outputs?.[0] || data.output?.video || data.output?.url;

                    if (!videoUrl || typeof videoUrl !== 'string') {
                        return JSON.stringify({ error: 'Generation completed but no video URL in response.', data });
                    }

                    console.log('[AI Tool] generateAiBroll: completed, downloading video...');

                    // Step 3: Download and import into media library
                    const videoBlob = await fetch(videoUrl).then(r => r.blob());
                    const fileName = `ai_broll_${Date.now()}.mp4`;

                    const metadata = await mediaLibraryService.importMediaBlob(
                        videoBlob,
                        fileName,
                        currentProject.id,
                        { tags: ['ai-broll', prompt.slice(0, 30)] }
                    );

                    useMediaLibraryStore.getState().loadMediaItems();

                    return JSON.stringify({
                        success: true,
                        mediaId: metadata.id,
                        width: metadata.width,
                        height: metadata.height,
                        durationSec: metadata.duration,
                        message: 'AI B-Roll generated and imported. Use add_clip_to_timeline to place it.',
                    });
                }

                if (data.status === 'failed' || data.status === 'error') {
                    return JSON.stringify({ error: `Generation failed: ${data.error || 'Unknown error'}` });
                }

                // Still processing
                console.log(`[AI Tool] generateAiBroll: polling... attempt ${i + 1}, status: ${data.status}`);
            }

            return JSON.stringify({ error: 'Generation timed out after 6 minutes.' });
        } catch (e) {
            return JSON.stringify({ error: `AI B-Roll generation failed: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private cutTimeRange(itemId: string, startSec: number, endSec: number): string {
        const { items, fps } = useTimelineStore.getState();
        const item = items.find(i => i.id === itemId);
        if (!item) return JSON.stringify({ error: `Item ${itemId} not found.` });

        const startFrame = Math.round(startSec * fps);
        const endFrame = Math.round(endSec * fps);

        // Validate range is within item bounds
        const itemEnd = item.from + item.durationInFrames;
        if (startFrame < item.from || endFrame > itemEnd || startFrame >= endFrame) {
            return JSON.stringify({ error: `Invalid range. Item spans ${(item.from / fps).toFixed(2)}s - ${(itemEnd / fps).toFixed(2)}s` });
        }

        try {
            // Split at end first (so IDs stay valid for second split)
            if (endFrame < itemEnd) {
                splitItem(itemId, endFrame);
            }

            // Now split at start — the original item ID still refers to the left portion
            const result = splitItem(itemId, startFrame);

            // The right part of the first split is the segment to remove
            if (result) {
                const rightId = (result as any).rightItem?.id;
                if (rightId) {
                    removeItems([rightId]);
                    return JSON.stringify({ success: true, message: `Removed ${startSec}s - ${endSec}s from clip.` });
                }
            }

            // Fallback: find the item that occupies the cut range and remove it
            const updatedItems = useTimelineStore.getState().items;
            const middleItem = updatedItems.find(i =>
                i.trackId === item.trackId &&
                i.from >= startFrame &&
                i.from + i.durationInFrames <= endFrame + fps // small tolerance
            );
            if (middleItem) {
                removeItems([middleItem.id]);
                return JSON.stringify({ success: true, message: `Removed ${startSec}s - ${endSec}s from clip.` });
            }

            return JSON.stringify({ success: true, message: `Split performed at ${startSec}s and ${endSec}s. Middle segment may need manual removal.` });
        } catch (e) {
            return JSON.stringify({ error: `Cut failed: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private async listHeygenAvatars(_ownership?: string): Promise<string> {
        try {
            const proxyImg = (url: string | null) => url ? `/api/v1/heygen/proxy-image?url=${encodeURIComponent(url)}` : null;

            // v2 API returns flat avatar list with avatar_id that works directly for video creation
            const data = await ApiClient.get<any>('/heygen/avatars');
            const avatarList = data?.data?.avatars ?? [];

            const avatars = avatarList.map((a: any) => ({
                id: a.avatar_id || a.id,
                name: a.avatar_name || a.name || a.avatar_id,
                preview_image: proxyImg(a.preview_image_url || null),
                gender: a.gender || '',
                subtitle: [a.gender, a.type === 'premium' ? '⭐' : ''].filter(Boolean).join(' · ') || undefined,
            }));

            // Auto-show picker — no groups/looks, flat selection
            useAiChatStore.getState().addSessionMessage({ role: 'assistant', content: 'Avatar seçin:' });
            return new Promise<string>((resolve) => {
                useAiChatStore.getState().setPendingUserInput({
                    question: 'Avatar seçin:',
                    options: null,
                    pickerType: 'avatar',
                    pickerItems: avatars,
                    resolve: (selectedId: string) => {
                        const found = avatars.find((a: any) => a.id === selectedId);
                        const originalAvatar = avatarList.find((a: any) => (a.avatar_id || a.id) === selectedId);
                        resolve(JSON.stringify({
                            selected_avatar_id: selectedId,
                            selected_name: found?.name || selectedId,
                            default_voice_id: originalAvatar?.default_voice_id || null,
                        }));
                    },
                });
            });
        } catch (e) {
            return JSON.stringify({ error: `Failed to list avatars: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private async listHeygenVoices(_language?: string, _gender?: string): Promise<string> {
        try {
            const data = await ApiClient.get<any>('/heygen/voices');
            // v2 returns data.voices
            const voiceList = data?.data?.voices ?? data?.data?.list ?? (Array.isArray(data?.data) ? data.data : []);
            const mapped = voiceList
                .filter((v: any) => v.voice_id) // all voices including custom
                .map((v: any) => ({
                    id: v.voice_id,
                    name: v.display_name || v.name || v.voice_id,
                    preview_audio: v.preview_audio || v.preview_audio_url || v.preview || null,
                    subtitle: `${v.language || ''} · ${v.gender || ''}`.trim(),
                    gender: v.gender || '',
                }))
                // Sort: voices with preview first, then custom without preview
                .sort((a: any, b: any) => {
                    if (a.preview_audio && !b.preview_audio) return -1;
                    if (!a.preview_audio && b.preview_audio) return 1;
                    return 0;
                });


            // Auto-show voice picker
            useAiChatStore.getState().addSessionMessage({ role: 'assistant', content: 'Səs seçin:' });
            return new Promise<string>((resolve) => {
                useAiChatStore.getState().setPendingUserInput({
                    question: 'Səs seçin:',
                    options: null,
                    pickerType: 'voice',
                    pickerItems: mapped,
                    resolve: (selectedId: string) => {
                        const found = mapped.find((v: any) => v.id === selectedId);
                        resolve(JSON.stringify({ selected_voice_id: selectedId, selected_name: found?.name || selectedId }));
                    },
                });
            });
        } catch (e) {
            return JSON.stringify({ error: `Failed to list voices: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private async showPicker(pickerType: 'avatar' | 'voice', items: any[]): Promise<string> {
        const question = pickerType === 'avatar' ? 'Avatar seçin:' : 'Səs seçin:';

        return new Promise<string>((resolve) => {
            useAiChatStore.getState().addSessionMessage({ role: 'assistant', content: question });
            useAiChatStore.getState().setPendingUserInput({
                question,
                options: null,
                pickerType,
                pickerItems: items,
                resolve: (selectedId: string) => {
                    // For avatar picker, find the selected item across groups and looks
                    let selectedName = selectedId;
                    if (pickerType === 'avatar') {
                        for (const item of items) {
                            if (item.id === selectedId) { selectedName = item.name; break; }
                            if (item.looks) {
                                const look = item.looks.find((l: any) => l.id === selectedId);
                                if (look) { selectedName = look.name; break; }
                            }
                        }
                    } else {
                        const found = items.find((i: any) => i.id === selectedId);
                        if (found) selectedName = found.name;
                    }
                    resolve(JSON.stringify({ selected_id: selectedId, selected_name: selectedName }));
                },
            });
        });
    }

    private async generateAvatarVideo(script: string, avatarId?: string, voiceId?: string): Promise<string> {
        const currentProject = useProjectStore.getState().currentProject;
        if (!currentProject) return JSON.stringify({ error: 'No project open.' });

        if (!avatarId) return JSON.stringify({ error: 'avatar_id is required. Use list_heygen_avatars + show_picker first.' });

        try {
            // Send avatar_id, script, voice_id — backend builds v2 payload
            const proj = useProjectStore.getState().currentProject;
            const w = proj?.metadata?.width || 1080;
            const h = proj?.metadata?.height || 1920;
            const aspectRatio = Math.abs(w / h - 16 / 9) < 0.1 ? '16:9' : Math.abs(w / h - 1) < 0.1 ? '1:1' : '9:16';

            const body: any = {
                avatar_id: avatarId,
                script,
                aspect_ratio: aspectRatio,
            };
            if (voiceId) body.voice_id = voiceId;

            const createResponse = await ApiClient.post<any>('/heygen/videos', body);
            const videoId = createResponse?.data?.video_id || createResponse?.data?.id;
            if (!videoId) return JSON.stringify({ error: 'Failed to create HeyGen video.', response: createResponse });

            console.log('[AI Tool] generateAvatarVideo: created, videoId:', videoId);

            // Step 2: Poll for completion
            for (let i = 0; i < 60; i++) {
                await new Promise(r => setTimeout(r, 5000));
                const statusResponse = await ApiClient.get<any>(`/heygen/videos/${videoId}`);
                const videoData = statusResponse?.data;

                if (videoData?.status === 'completed') {
                    const videoUrl = videoData.video_url;
                    if (!videoUrl) return JSON.stringify({ error: 'Video completed but no URL.', data: videoData });

                    console.log('[AI Tool] generateAvatarVideo: completed! Downloading from:', videoUrl);

                    // Download via proxy to bypass COEP
                    const proxyUrl = `/api/v1/heygen/proxy-image?url=${encodeURIComponent(videoUrl)}`;
                    const videoBlob = await fetch(proxyUrl).then(r => r.blob());
                    const metadata = await mediaLibraryService.importMediaBlob(videoBlob, `avatar_video_${Date.now()}.mp4`, currentProject.id, { tags: ['avatar-video'] });
                    useMediaLibraryStore.getState().loadMediaItems();

                    // Get subtitle URL and auto-import captions
                    const captionUrl = videoData.caption_url || videoData.subtitle_url || null;
                    let captionsAdded = false;

                    if (captionUrl) {
                        try {
                            // Download SRT via proxy
                            const proxyUrl2 = `/api/v1/heygen/proxy-image?url=${encodeURIComponent(captionUrl)}`;
                            const srtText = await fetch(proxyUrl2).then(r => r.text());

                            if (srtText && srtText.includes('-->')) {
                                // Parse SRT and save as transcript
                                const { json2VideoService } = await import('@/features/media-library/services/json2video-service');
                                const segments = json2VideoService.parseSrtToSegments(srtText);

                                if (segments.length > 0) {
                                    const { saveTranscript } = await import('@/infrastructure/storage/indexeddb/transcripts');
                                    await saveTranscript({
                                        id: metadata.id,
                                        mediaId: metadata.id,
                                        model: 'whisper-tiny' as any,
                                        language: undefined as any,
                                        quantization: 'hybrid' as any,
                                        text: segments.map(s => s.text).join(' '),
                                        segments,
                                        createdAt: Date.now(),
                                        updatedAt: Date.now(),
                                    });
                                    captionsAdded = true;
                                }
                            }
                        } catch (e) {
                            console.warn('[AI Tool] Failed to import HeyGen subtitles:', e);
                        }
                    }

                    return JSON.stringify({
                        success: true,
                        mediaId: metadata.id,
                        width: metadata.width,
                        height: metadata.height,
                        durationSec: metadata.duration,
                        captionsImported: captionsAdded,
                        message: captionsAdded
                            ? 'Avatar video generated with subtitles. Use add_clip_to_timeline to place it, then add_captions to add subtitles.'
                            : 'Avatar video generated and imported. Use add_clip_to_timeline to place it.',
                    });
                }

                if (videoData?.status === 'failed') {
                    return JSON.stringify({ error: `HeyGen video failed: ${videoData.error || 'Unknown error'}` });
                }

                console.log(`[AI Tool] generateAvatarVideo: polling #${i + 1}, status: ${videoData?.status}`);
            }

            return JSON.stringify({ error: 'HeyGen video generation timed out after 5 minutes.' });
        } catch (e) {
            return JSON.stringify({ error: `Avatar video failed: ${e instanceof Error ? e.message : String(e)}` });
        }
    }

    private removeItemsById(itemIds: string[]): string {
        if (itemIds.length === 0) return 'No items to remove.';
        removeItems(itemIds);
        return `Removed ${itemIds.length} item(s).`;
    }

    private async addClipToTimeline(mediaId: string, trackId?: string, startTimeSec?: number, durationSec?: number): Promise<string> {
        try {
            const { fps, tracks } = useTimelineStore.getState();
            if (startTimeSec === undefined) return JSON.stringify({ error: 'startTimeSec is required' });

            const media = await mediaLibraryService.getMedia(mediaId);
            if (!media) return JSON.stringify({ error: `Media ID ${mediaId} not found in library.` });

            let finalTrackId = trackId;
            if (!finalTrackId) {
                const { items: allItems } = useTimelineStore.getState();
                // Find B-Roll track by name AND verify it actually has video items (not captions)
                const brollTrack = tracks.find(t => {
                    if (t.name !== 'B-Roll') return false;
                    // Check if track contains video items (not text/captions)
                    const trackItems = allItems.filter(i => i.trackId === t.id);
                    // Empty track or track with video items is OK
                    return trackItems.length === 0 || trackItems.some(i => i.type === 'video');
                });
                if (brollTrack) {
                    finalTrackId = brollTrack.id;
                } else {
                    // App convention: LOWER track order = visually on top.
                    // New B-Roll goes BELOW everything (highest order) so existing captions/text/effects
                    // remain on top of it. (Earlier code did the opposite and hid captions behind video.)
                    const maxOrder = tracks.reduce((highest, track) => Math.max(highest, track.order), -1);
                    const brollOrder = maxOrder + 1;

                    const newTrackId = crypto.randomUUID();
                    const newTrack = {
                        id: newTrackId,
                        name: 'B-Roll',
                        kind: 'video' as const,
                        height: 96,
                        locked: false,
                        visible: true,
                        muted: false,
                        solo: false,
                        order: brollOrder,
                        items: [],
                    };
                    const { setTracks } = await import('@/features/timeline/stores/actions/track-actions');
                    setTracks([...tracks, newTrack]);
                    finalTrackId = newTrackId;
                }
            }

            // Clamp startTimeSec to avoid placement far past the actual video end.
            // The AI sometimes computes "end of timeline" from caption/text items that extend
            // far beyond real video content; we cap to (last video item end + 1s) when the
            // requested start is more than 30s past it.
            const allItemsForClamp = useTimelineStore.getState().items;
            const videoOnly = allItemsForClamp.filter(i => i.type === 'video' || i.type === 'audio');
            let lastMediaEndSec = 0;
            for (const it of videoOnly) {
                const endFrame = (it.from ?? 0) + (it.durationInFrames ?? 0);
                lastMediaEndSec = Math.max(lastMediaEndSec, endFrame / fps);
            }
            let effectiveStartSec = startTimeSec;
            if (lastMediaEndSec > 0 && startTimeSec > lastMediaEndSec + 30) {
                console.warn(`[AI Tool] addClipToTimeline: requested ${startTimeSec.toFixed(1)}s is far past last video end ${lastMediaEndSec.toFixed(1)}s — clamping`);
                effectiveStartSec = lastMediaEndSec;
            }

            const fromFrame = Math.round(effectiveStartSec * fps);
            const sourceDurationFrames = Math.round((media.duration || 5) * fps);
            const durationInFrames = durationSec !== undefined ? Math.round(durationSec * fps) : sourceDurationFrames;

            // Calculate fill transform — scale b-roll to cover entire canvas
            const currentProject = useProjectStore.getState().currentProject;
            const canvasW = currentProject?.metadata.width || 1920;
            const canvasH = currentProject?.metadata.height || 1080;
            const srcW = media.width || canvasW;
            const srcH = media.height || canvasH;

            // Cover/fill: scale so source fills canvas completely (may crop)
            const scaleX = canvasW / srcW;
            const scaleY = canvasH / srcH;
            const fillScale = Math.max(scaleX, scaleY);
            const fillW = Math.round(srcW * fillScale);
            const fillH = Math.round(srcH * fillScale);

            // Default to true for video media — audioCodec may be undefined for older blob imports
            // (importMediaBlob didn't persist it before this fix). The audio item is harmless if
            // the source has no audio track (renders silence).
            const mediaType = getMediaType(media.mimeType);
            const hasAudio = mediaType === 'video' && media.audioCodec !== '';
            const linkedGroupId = hasAudio ? crypto.randomUUID() : undefined;
            const clipDurationFrames = Math.min(durationInFrames, sourceDurationFrames);

            const videoItem: any = {
                id: crypto.randomUUID(),
                type: 'video',
                trackId: finalTrackId,
                mediaId: media.id,
                from: fromFrame,
                durationInFrames: clipDurationFrames,
                sourceStart: 0,
                sourceDuration: sourceDurationFrames,
                sourceWidth: srcW,
                sourceHeight: srcH,
                speed: 1,
                volume: 100,
                linkedGroupId,
                label: `B-Roll: ${media.id.split('_')[0]}`,
                transform: {
                    x: 0,
                    y: 0,
                    width: fillW,
                    height: fillH,
                },
            };

            const { addItem } = await import('@/features/timeline/stores/timeline-actions');
            addItem(videoItem);

            // Companion audio item so embedded audio renders in export
            // (manual imports do this in source-edit-actions.ts; AI clips were silent without it)
            if (hasAudio) {
                const allTracksNow = useTimelineStore.getState().tracks;
                let audioTrackId = allTracksNow.find(t => t.kind === 'audio' && !t.locked)?.id;
                if (!audioTrackId) {
                    const newAudioTrackId = crypto.randomUUID();
                    const maxOrder = allTracksNow.reduce((highest, t) => Math.max(highest, t.order), -1);
                    const newAudioTrack = {
                        id: newAudioTrackId,
                        name: 'Audio',
                        kind: 'audio' as const,
                        height: 64,
                        locked: false,
                        visible: true,
                        muted: false,
                        solo: false,
                        order: maxOrder + 1,
                        items: [],
                    };
                    const { setTracks } = await import('@/features/timeline/stores/actions/track-actions');
                    setTracks([...allTracksNow, newAudioTrack]);
                    audioTrackId = newAudioTrackId;
                }

                const audioItem: any = {
                    id: crypto.randomUUID(),
                    type: 'audio',
                    trackId: audioTrackId,
                    mediaId: media.id,
                    from: fromFrame,
                    durationInFrames: clipDurationFrames,
                    sourceStart: 0,
                    sourceDuration: sourceDurationFrames,
                    speed: 1,
                    volume: 100,
                    linkedGroupId,
                    label: media.fileName ?? `B-Roll Audio: ${media.id.split('_')[0]}`,
                };
                addItem(audioItem);
            }

            return JSON.stringify({ success: true, itemId: videoItem.id, trackId: finalTrackId, fromFrame, hasAudio });
        } catch (e) {
            return JSON.stringify({ error: `Failed to add clip to timeline: ${e instanceof Error ? e.message : String(e)}` });
        }
    }
}
