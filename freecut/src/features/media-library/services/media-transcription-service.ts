import {
  deleteTranscript,
  getTranscript,
  getTranscriptMediaIds,
  saveTranscript,
} from '@/infrastructure/storage/indexeddb';
import { ApiClient } from '@/infrastructure/api/api-client';
import { usePlaybackStore } from '@/shared/state/playback';
import { useSelectionStore } from '@/shared/state/selection';
import { createLogger } from '@/shared/logging/logger';
import type { MediaTranscript, MediaTranscriptModel } from '@/types/storage';
import type { AudioItem, TextItem, TimelineItem, TimelineTrack, VideoItem } from '@/types/timeline';
import type { TranscribeOptions } from '../transcription/types';
import { json2VideoService } from './json2video-service';
import { mediaLibraryService } from './media-library-service';
import {
  buildCaptionTextItems,
  buildCaptionTrack,
  findReplaceableCaptionItemsForClip,
  findCompatibleCaptionTrackForRanges,
  getCaptionTextItemTemplate,
  getCaptionRangeForClip,
} from '../utils/caption-items';
import { useProjectStore } from '@/features/media-library/deps/projects';
import { useTimelineStore } from '@/features/media-library/deps/timeline-stores';
import { useSettingsStore } from '@/features/media-library/deps/settings-contract';
import {
  DEFAULT_WHISPER_MODEL,
  DEFAULT_WHISPER_QUANTIZATION,
  normalizeWhisperLanguage,
} from '@/shared/utils/whisper-settings';

const logger = createLogger('MediaTranscriptionService');
const DEFAULT_MODEL: MediaTranscriptModel = DEFAULT_WHISPER_MODEL;
const DEFAULT_QUANTIZATION = DEFAULT_WHISPER_QUANTIZATION;

type CaptionableClip = AudioItem | VideoItem;
interface InsertTranscriptAsCaptionsOptions {
  clipIds?: readonly string[];
  replaceExisting?: boolean;
}

interface InsertTranscriptAsCaptionsResult {
  insertedItemCount: number;
  removedItemCount: number;
}

class MediaTranscriptionService {

  async getTranscript(mediaId: string): Promise<MediaTranscript | null> {
    // 1. Check IndexedDB first (Fast)
    const localTranscript = await getTranscript(mediaId);
    if (localTranscript) return localTranscript;

    // 2. Check Backend if in a project context
    const project = useProjectStore.getState().currentProject;
    if (project) {
      try {
        const { transcript: backendTranscript } = await ApiClient.get<{ transcript: MediaTranscript | null }>(
          `/projects/${project.id}/transcripts/${mediaId}`
        );
        if (backendTranscript) {
          logger.info('Transcript found on backend, saving to local IndexedDB.');
          await saveTranscript(backendTranscript);
          return backendTranscript;
        }
      } catch (err) {
        logger.warn('Failed to check backend for transcript:', err);
      }
    }

    return null;
  }

  getTranscriptMediaIds = getTranscriptMediaIds;
  deleteTranscript = deleteTranscript;

  async transcribeMedia(
    mediaId: string,
    options: Pick<TranscribeOptions, 'language' | 'model' | 'quantization' | 'onProgress'> = {},
  ): Promise<MediaTranscript> {
    const existing = await this.getTranscript(mediaId);
    if (existing) {
      logger.info('Transcript already exists (local or backend), returning it.');
      return existing;
    }

    const media = await mediaLibraryService.getMedia(mediaId);
    if (!media) {
      throw new Error(`Media not found: ${mediaId}`);
    }

    if (!media.mimeType.startsWith('audio/') && !media.mimeType.startsWith('video/')) {
      throw new Error('Only audio and video files can be transcribed');
    }

    const blob = await mediaLibraryService.getMediaFile(mediaId);
    if (!blob) {
      throw new Error(`Could not load media file: ${media.fileName}`);
    }

    // Extract audio from video to reduce file size (77MB video → ~2MB audio)
    let fileToSend: File;
    if (media.mimeType.startsWith('video/')) {
      logger.info('Extracting audio from video for transcription...');
      if (options.onProgress) {
        options.onProgress({ stage: 'loading', progress: 0 });
      }
      try {
        const audioBlob = await this.extractAudioFromVideo(blob);
        fileToSend = new File([audioBlob], 'audio.mp3', { type: 'audio/mpeg' });
        logger.info(`Audio extracted: ${(audioBlob.size / 1024 / 1024).toFixed(1)}MB (from ${(blob.size / 1024 / 1024).toFixed(1)}MB video)`);
      } catch (extractErr) {
        logger.warn('Audio extraction failed, sending full video:', extractErr);
        fileToSend = blob instanceof File
          ? blob
          : new File([blob], media.fileName, { type: media.mimeType });
      }
    } else {
      fileToSend = blob instanceof File
        ? blob
        : new File([blob], media.fileName, {
          type: media.mimeType,
          lastModified: media.fileLastModified ?? Date.now(),
        });
    }
    const file = fileToSend;

    const settings = useSettingsStore.getState();
    const model = options.model ?? settings.defaultWhisperModel ?? DEFAULT_MODEL;
    const quantization = options.quantization ?? settings.defaultWhisperQuantization ?? DEFAULT_QUANTIZATION;
    const language = normalizeWhisperLanguage(options.language ?? settings.defaultWhisperLanguage) || undefined;

    let jobId: string;
    try {
      jobId = await json2VideoService.startTranscription(file, language === 'auto' ? undefined : language);
      logger.info(`Transcription job started: ${jobId}`);
    } catch (err: any) {
      logger.error('Failed to start transcription job:', err);
      throw new Error(`Failed to start transcription: ${err.message || 'Connection to transcription server failed. Is json2video server running?'}`);
    }

    let srtUrl: string;
    try {
      const result = await json2VideoService.pollJobStatus(jobId, () => {
        if (options.onProgress) {
          options.onProgress({ stage: 'decoding', progress: 0 });
        }
      });
      srtUrl = result.srtUrl;
    } catch (err: any) {
      logger.error('Transcription job failed during polling:', err);
      throw new Error(`Transcription job failed: ${err.message}`);
    }

    const srtText = await json2VideoService.downloadSrt(srtUrl);
    const segments = json2VideoService.parseSrtToSegments(srtText);

    const transcript: MediaTranscript = {
      id: mediaId,
      mediaId,
      model,
      language,
      quantization,
      text: segments.map((segment) => segment.text.trim()).filter(Boolean).join(' ').trim(),
      segments: segments.map((segment) => ({
        text: segment.text.trim(),
        start: segment.start,
        end: segment.end,
      })),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await saveTranscript(transcript);

    // New: Save to backend
    const project = useProjectStore.getState().currentProject;
    if (project) {
      try {
        await ApiClient.put(`/projects/${project.id}/transcripts/${mediaId}`, {
          transcript,
          media_name: media.fileName,
        });
        logger.info('Saved transcript to backend');
      } catch (err) {
        logger.error('Failed to save transcript to backend:', err);
      }
    }

    logger.info('Saved transcript to IndexedDB', {
      mediaId,
      segments: transcript.segments.length,
      model: transcript.model,
    });
    return transcript;
  }

  private async extractAudioFromVideo(videoBlob: Blob): Promise<Blob> {
    const audioContext = new AudioContext();
    const arrayBuffer = await videoBlob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // Encode as WAV (simple, no external dependencies)
    const numberOfChannels = Math.min(audioBuffer.numberOfChannels, 1); // mono
    const sampleRate = Math.min(audioBuffer.sampleRate, 16000); // 16kHz is enough for speech
    const length = audioBuffer.length;

    // Resample to target sample rate
    const offlineCtx = new OfflineAudioContext(numberOfChannels, Math.ceil(length * sampleRate / audioBuffer.sampleRate), sampleRate);
    const source = offlineCtx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineCtx.destination);
    source.start();
    const renderedBuffer = await offlineCtx.startRendering();

    // Encode WAV
    const wavBuffer = this.encodeWav(renderedBuffer);
    await audioContext.close();
    return new Blob([wavBuffer], { type: 'audio/wav' });
  }

  private encodeWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const numChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const format = 1; // PCM
    const bitsPerSample = 16;
    const samples = audioBuffer.getChannelData(0);
    const dataLength = samples.length * numChannels * (bitsPerSample / 8);
    const buffer = new ArrayBuffer(44 + dataLength);
    const view = new DataView(buffer);

    const writeString = (offset: number, str: string) => {
      for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
    };

    writeString(0, 'RIFF');
    view.setUint32(4, 36 + dataLength, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, format, true);
    view.setUint16(22, numChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate * numChannels * (bitsPerSample / 8), true);
    view.setUint16(32, numChannels * (bitsPerSample / 8), true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataLength, true);

    let offset = 44;
    for (let i = 0; i < samples.length; i++) {
      const s = Math.max(-1, Math.min(1, samples[i]!));
      view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      offset += 2;
    }

    return buffer;
  }

  async insertTranscriptAsCaptions(
    mediaId: string,
    options: InsertTranscriptAsCaptionsOptions = {},
  ): Promise<InsertTranscriptAsCaptionsResult> {
    const transcript = await this.getTranscript(mediaId);
    if (!transcript) {
      throw new Error('No transcript found for this media item. Please transcribe it first.');
    }

    const timeline = useTimelineStore.getState();
    const project = useProjectStore.getState().currentProject;
    const targetClips = this.resolveCaptionTargetClips(mediaId, options.clipIds);
    if (targetClips.length === 0) {
      throw new Error('Select a clip for this media, or place one on the timeline first');
    }

    const canvasWidth = project?.metadata.width ?? 1920;
    const canvasHeight = project?.metadata.height ?? 1080;
    const newTracks: TimelineTrack[] = [...timeline.tracks];
    const generatedCaptionIdsToRemove = options.replaceExisting
      ? new Set(
        targetClips.flatMap((clip) =>
          findReplaceableCaptionItemsForClip(timeline.items, clip).map((item) => item.id)
        )
      )
      : new Set<string>();
    const plannedItems = timeline.items.filter((item) => !generatedCaptionIdsToRemove.has(item.id));
    const insertedItems: TextItem[] = [];

    for (const clip of targetClips) {
      const clipRange = getCaptionRangeForClip(clip, transcript.segments, timeline.fps);
      if (!clipRange) {
        continue;
      }

      const existingGeneratedCaptions = options.replaceExisting
        ? findReplaceableCaptionItemsForClip(timeline.items, clip)
        : [];
      const preferredTrackId = this.resolvePreferredCaptionTrackId(
        newTracks,
        plannedItems,
        existingGeneratedCaptions,
        clipRange,
      );

      let targetTrack = preferredTrackId
        ? newTracks.find((track) => track.id === preferredTrackId) ?? null
        : findCompatibleCaptionTrackForRanges(
          newTracks,
          plannedItems,
          [{ startFrame: clipRange.startFrame, endFrame: clipRange.endFrame }],
        );

      if (!targetTrack) {
        targetTrack = buildCaptionTrack(newTracks);
        newTracks.push(targetTrack);
        newTracks.sort((a, b) => a.order - b.order);
      }

      const clipCaptionItems = buildCaptionTextItems({
        mediaId,
        trackId: targetTrack.id,
        segments: transcript.segments,
        clip,
        timelineFps: timeline.fps,
        canvasWidth,
        canvasHeight,
        styleTemplate: existingGeneratedCaptions[0]
          ? getCaptionTextItemTemplate(existingGeneratedCaptions[0])
          : undefined,
      });

      if (clipCaptionItems.length === 0) {
        continue;
      }

      insertedItems.push(...clipCaptionItems);
      plannedItems.push(...clipCaptionItems);
    }

    if (insertedItems.length === 0 && generatedCaptionIdsToRemove.size === 0) {
      throw new Error('Transcript does not overlap the selected clip source range');
    }

    const tracksChanged = newTracks.length !== timeline.tracks.length
      || newTracks.some((track, index) => track.id !== timeline.tracks[index]?.id);
    if (tracksChanged) {
      timeline.setTracks(newTracks);
    }

    if (generatedCaptionIdsToRemove.size > 0) {
      timeline.removeItems([...generatedCaptionIdsToRemove]);
    }

    if (insertedItems.length > 0) {
      timeline.addItems(insertedItems);
      useSelectionStore.getState().selectItems(insertedItems.map((item) => item.id));
    }

    return {
      insertedItemCount: insertedItems.length,
      removedItemCount: generatedCaptionIdsToRemove.size,
    };
  }

  private resolveCaptionTargetClips(
    mediaId: string,
    clipIds?: readonly string[],
  ): CaptionableClip[] {
    const timeline = useTimelineStore.getState();
    const selection = useSelectionStore.getState();
    const playheadFrame = usePlaybackStore.getState().currentFrame;

    const matchingClips = timeline.items
      .filter((item): item is CaptionableClip =>
        (item.type === 'video' || item.type === 'audio') && item.mediaId === mediaId
      )
      .sort((a, b) => a.from - b.from);

    if (matchingClips.length === 0) {
      return [];
    }

    if (clipIds && clipIds.length > 0) {
      const requestedClipIds = new Set(clipIds);
      return matchingClips.filter((clip) => requestedClipIds.has(clip.id));
    }

    const selectedClips = selection.selectedItemIds
      .map((id) => matchingClips.find((clip) => clip.id === id))
      .filter((clip): clip is CaptionableClip => clip !== undefined);

    if (selectedClips.length > 0) {
      return selectedClips;
    }

    if (matchingClips.length === 1) {
      return matchingClips;
    }

    const clipAtPlayhead = matchingClips.find(
      (clip) => playheadFrame >= clip.from && playheadFrame < clip.from + clip.durationInFrames
    );
    if (clipAtPlayhead) {
      return [clipAtPlayhead];
    }

    return [];
  }

  private resolvePreferredCaptionTrackId(
    tracks: readonly TimelineTrack[],
    items: readonly TimelineItem[],
    existingCaptions: ReadonlyArray<{ trackId: string }>,
    range: { startFrame: number; endFrame: number },
  ): string | null {
    const trackIds = [...new Set(existingCaptions.map((item) => item.trackId))];
    if (trackIds.length !== 1) {
      return null;
    }

    const preferredTrack = tracks.find((track) => track.id === trackIds[0]);
    if (!preferredTrack || preferredTrack.visible === false || preferredTrack.locked || preferredTrack.isGroup) {
      return null;
    }

    const hasOverlap = items.some((item) => {
      if (item.trackId !== preferredTrack.id) {
        return false;
      }

      const itemEnd = item.from + item.durationInFrames;
      return item.from < range.endFrame && itemEnd > range.startFrame;
    });

    return hasOverlap ? null : preferredTrack.id;
  }
}

export const mediaTranscriptionService = new MediaTranscriptionService();
