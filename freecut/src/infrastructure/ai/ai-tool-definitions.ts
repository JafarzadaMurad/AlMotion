export const AI_TOOLS = [
    {
        type: 'function',
        function: {
            name: 'send_chat_message',
            description: 'Send a conversational message to the user. You MUST use this tool to explain what you are doing BEFORE triggering long-running tools like transcribe_media, search_and_import_pexels, or add_captions. Use parallel tool calling to execute this alongside your main action.',
            parameters: {
                type: 'object',
                properties: {
                    message: {
                        type: 'string',
                        description: 'The natural language message to show the user (e.g. "Mən videonu transkripsiya edirəm, zəhmət olmasa gözləyin...").',
                    },
                },
                required: ['message'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'ask_user',
            description: 'Ask the user a question and wait for their response before proceeding. Use when you need clarification, confirmation, or a choice (e.g. color, style, which item). The tool pauses execution until the user responds.',
            parameters: {
                type: 'object',
                properties: {
                    question: {
                        type: 'string',
                        description: 'The question to ask the user.',
                    },
                    options: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'Optional quick-reply buttons (e.g. ["Sarı", "Qırmızı", "Yaşıl"]). User can also type a custom answer.',
                    },
                },
                required: ['question'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'split_selected_clips',
            description: 'Split the currently selected clips at the playhead or a specific frame.',
            parameters: {
                type: 'object',
                properties: {
                    frame: {
                        type: 'number',
                        description: 'Optional frame to split at. If not provided, uses current playhead.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'delete_selected_items',
            description: 'Delete the currently selected items from the timeline.',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'move_selected_items',
            description: 'Move selected items by a number of frames or to a specific position.',
            parameters: {
                type: 'object',
                properties: {
                    deltaFrames: {
                        type: 'number',
                        description: 'Number of frames to move (can be negative).',
                    },
                },
                required: ['deltaFrames'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_text_item',
            description: 'Add a new text item to the timeline with full styling options.',
            parameters: {
                type: 'object',
                properties: {
                    text: { type: 'string', description: 'The text content.' },
                    startTimeSec: { type: 'number', description: 'Start time in seconds. If omitted, uses current playhead.' },
                    durationSec: { type: 'number', description: 'Duration in seconds. Default: 5.' },
                    color: { type: 'string', description: 'Text color hex (e.g. "#FFFFFF"). Default: white.' },
                    backgroundColor: { type: 'string', description: 'Background color (hex or "transparent").' },
                    fontSize: { type: 'number', description: 'Font size in pixels (e.g. 48, 60, 72).' },
                    fontFamily: { type: 'string', description: 'Font family (e.g. "Inter", "Arial").' },
                    fontWeight: { type: 'string', enum: ['normal', 'medium', 'semibold', 'bold'] },
                    positionY: { type: 'number', description: 'Vertical position 0-100 (0=top, 50=center, 100=bottom).' },
                    positionX: { type: 'number', description: 'Horizontal position 0-100 (0=left, 50=center, 100=right).' },
                },
                required: ['text'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_timeline_info',
            description: 'Get information about the current timeline status, selections, and playback position.',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
    },
    // NOTE: search_pexels_videos was removed. The generate_brolls tool handles
    // the full pipeline internally (transcript -> keywords -> search -> download -> place on timeline).
    {
        type: 'function',
        function: {
            name: 'search_and_import_pexels',
            description: 'Search Pexels for a stock video and import it into the Media Library. Returns the mediaId which can then be added to the timeline.',
            parameters: {
                type: 'object',
                properties: {
                    query: {
                        type: 'string',
                        description: 'The search keyword or concept.',
                    },
                    orientation: {
                        type: 'string',
                        enum: ['landscape', 'portrait', 'square'],
                        description: 'Optional desired orientation of the video to match the project.',
                    },
                },
                required: ['query'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_clip_to_timeline',
            description: 'Add an imported media asset to the timeline at a specific second.',
            parameters: {
                type: 'object',
                properties: {
                    mediaId: {
                        type: 'string',
                        description: 'The ID of the media asset to add.',
                    },
                    targetTrackId: {
                        type: 'string',
                        description: 'Optional ID of the track to place it on. If omitted, it will try to place it on a new or compatible track.',
                    },
                    startTimeSec: {
                        type: 'number',
                        description: 'The time in seconds (e.g. 1.5) where the clip should start on the timeline.',
                    },
                    durationSec: {
                        type: 'number',
                        description: 'Optional duration in seconds. If provided, the clip will be trimmed to this duration.',
                    },
                },
                required: ['mediaId', 'startTimeSec'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'transcribe_media',
            description: 'Transcribe a media item to generate a text transcript (SRT) and save it to the local store.',
            parameters: {
                type: 'object',
                properties: {
                    mediaId: {
                        type: 'string',
                        description: 'The ID of the media item to transcribe.',
                    },
                },
                required: ['mediaId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'add_captions',
            description: 'Insert the existing transcript of a media item onto the timeline as text captions/subtitles. If the same mediaId is used by multiple clips (e.g. a primary clip plus B-roll cutaways reusing the source), pass clipId to pick the correct one (typically the longest / primary audio clip). Use get_timeline_info first to find clip IDs.',
            parameters: {
                type: 'object',
                properties: {
                    mediaId: {
                        type: 'string',
                        description: 'The ID of the media item whose transcript should be used for captions.',
                    },
                    clipId: {
                        type: 'string',
                        description: 'Optional. ID of a specific timeline clip to caption. Pass when multiple clips share the same mediaId — choose the primary (longest, full-audio) clip ID.',
                    },
                },
                required: ['mediaId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_media_library_info',
            description: 'Get a list of all media assets currently imported into the project library.',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'get_media_transcript',
            description: 'Get the text transcript and segments (with start/end timestamps) for a specific media item. Provides the exact spoken words to help with b-roll placement or accurate trimming. Transcripts must be generated first.',
            parameters: {
                type: 'object',
                properties: {
                    mediaId: {
                        type: 'string',
                        description: 'The ID of the media item to get the transcript for.',
                    },
                },
                required: ['mediaId'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'update_item_style',
            description: 'Update visual properties of text/caption items (color, font, size, background, shadow, stroke, etc.). Can update multiple items at once.',
            parameters: {
                type: 'object',
                properties: {
                    itemIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of text/caption item IDs to update. Use get_timeline_info to find IDs.',
                    },
                    properties: {
                        type: 'object',
                        description: 'Properties to update on each item.',
                        properties: {
                            text: { type: 'string', description: 'New text content to replace existing text.' },
                            color: { type: 'string', description: 'Text color (hex e.g. "#FF0000")' },
                            backgroundColor: { type: 'string', description: 'Background color (hex or "transparent")' },
                            fontSize: { type: 'number', description: 'Font size in pixels (e.g. 48, 60, 72)' },
                            fontFamily: { type: 'string', description: 'Font family (e.g. "Inter", "Arial", "Roboto")' },
                            fontWeight: { type: 'string', enum: ['normal', 'medium', 'semibold', 'bold'], description: 'Font weight' },
                            fontStyle: { type: 'string', enum: ['normal', 'italic'], description: 'Font style' },
                            textAlign: { type: 'string', enum: ['left', 'center', 'right'], description: 'Text alignment' },
                            lineHeight: { type: 'number', description: 'Line height multiplier (e.g. 1.2)' },
                            letterSpacing: { type: 'number', description: 'Letter spacing in pixels' },
                            stroke: {
                                type: 'object',
                                description: 'Text stroke/outline',
                                properties: {
                                    width: { type: 'number', description: 'Stroke width in pixels' },
                                    color: { type: 'string', description: 'Stroke color (hex)' },
                                },
                            },
                            textShadow: {
                                type: 'object',
                                description: 'Text shadow',
                                properties: {
                                    offsetX: { type: 'number' },
                                    offsetY: { type: 'number' },
                                    blur: { type: 'number' },
                                    color: { type: 'string', description: 'Shadow color (hex)' },
                                },
                            },
                            positionY: { type: 'number', description: 'Vertical position as percentage of canvas height (0 = top, 50 = center, 100 = bottom). E.g. 10 for top area, 80 for bottom area.' },
                            positionX: { type: 'number', description: 'Horizontal position as percentage of canvas width (0 = left, 50 = center, 100 = right).' },
                            opacity: { type: 'number', description: 'Opacity from 0 to 1.' },
                        },
                    },
                },
                required: ['itemIds', 'properties'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'remove_items',
            description: 'Remove specific timeline items by their IDs.',
            parameters: {
                type: 'object',
                properties: {
                    itemIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of item IDs to remove.',
                    },
                },
                required: ['itemIds'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generate_ai_broll',
            description: 'Generate an AI-created B-Roll video clip using WaveSpeed (Seedance model). Describe the scene you want and it will generate a short video clip. The generated video is automatically imported into the Media Library. Use add_clip_to_timeline to place it on the timeline after generation.',
            parameters: {
                type: 'object',
                properties: {
                    prompt: {
                        type: 'string',
                        description: 'Detailed description of the scene to generate (e.g. "A person typing on a laptop in a modern office, cinematic lighting, 4K quality").',
                    },
                    duration: {
                        type: 'number',
                        description: 'Duration in seconds (2-12). Default: 5.',
                    },
                    aspect_ratio: {
                        type: 'string',
                        enum: ['21:9', '16:9', '4:3', '1:1', '3:4', '9:16'],
                        description: 'Aspect ratio. Should match the project format. Default: auto-detected from project.',
                    },
                },
                required: ['prompt'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_heygen_avatars',
            description: 'List and show available HeyGen avatars as a visual picker. Automatically pauses and waits for user to select an avatar. Returns the selected avatar_id. Call once — do NOT repeat.',
            parameters: {
                type: 'object',
                properties: {
                    ownership: {
                        type: 'string',
                        enum: ['public', 'private'],
                        description: 'Filter: "public" for HeyGen stock avatars, "private" for user-created avatars. Default: public.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'list_heygen_voices',
            description: 'List and show available HeyGen voices as a picker with audio preview. Automatically pauses and waits for user to select a voice. Returns the selected voice_id. Call once — do NOT repeat.',
            parameters: {
                type: 'object',
                properties: {
                    language: {
                        type: 'string',
                        description: 'Filter by language (e.g. "Turkish", "English", "Azerbaijani").',
                    },
                    gender: {
                        type: 'string',
                        enum: ['male', 'female'],
                        description: 'Filter by gender.',
                    },
                },
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'show_picker',
            description: 'Show a rich media picker in the chat for the user to select from. Supports avatar cards with preview images and voice list with audio preview. Pauses execution until user selects. Use after list_heygen_avatars or list_heygen_voices to present choices visually.',
            parameters: {
                type: 'object',
                properties: {
                    picker_type: {
                        type: 'string',
                        enum: ['avatar', 'voice'],
                        description: '"avatar" shows image cards, "voice" shows audio list with play buttons.',
                    },
                    items: {
                        type: 'array',
                        description: 'For avatars: pass the full groups array from list_heygen_avatars (includes looks). For voices: pass voices array.',
                        items: {
                            type: 'object',
                            properties: {
                                id: { type: 'string' },
                                name: { type: 'string' },
                                preview_image: { type: 'string' },
                                preview_audio: { type: 'string' },
                                subtitle: { type: 'string' },
                                gender: { type: 'string' },
                                looks: {
                                    type: 'array',
                                    description: 'Avatar looks/outfits. User picks a look ID for video creation.',
                                    items: {
                                        type: 'object',
                                        properties: {
                                            id: { type: 'string' },
                                            name: { type: 'string' },
                                            preview_image: { type: 'string' },
                                        },
                                    },
                                },
                            },
                            required: ['id', 'name'],
                        },
                    },
                },
                required: ['picker_type', 'items'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'generate_avatar_video',
            description: 'Generate an AI avatar talking-head video using HeyGen. Creates a video of an avatar speaking the given script text. The video is automatically imported into the Media Library. Use add_clip_to_timeline to place it afterwards.',
            parameters: {
                type: 'object',
                properties: {
                    script: {
                        type: 'string',
                        description: 'The text the avatar will speak.',
                    },
                    avatar_id: {
                        type: 'string',
                        description: 'The selected_avatar_id from list_heygen_avatars result. MUST be the exact ID string, NOT the avatar name.',
                    },
                    voice_id: {
                        type: 'string',
                        description: 'The selected_voice_id from list_heygen_voices result. MUST be the exact ID string, NOT the voice name.',
                    },
                },
                required: ['script'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'capture_current_frame',
            description: 'Capture a screenshot of the current preview canvas. Returns a base64 image so you can SEE the frame. Use this as a SILENT input for placement/styling decisions — do NOT respond with a verbal description of the image. After seeing the frame, immediately call the appropriate action tool (update_item_style, move_items_by_id, etc.) to fulfill the user request.',
            parameters: {
                type: 'object',
                properties: {},
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'capture_video_frames',
            description: 'Capture multiple frames from the video at specific timestamps. Returns base64 images so you can SEE the content. Use as SILENT input for placement/styling decisions — never reply with a long visual description of the frames. Immediately call the action tool the user asked for (e.g. update_item_style for repositioning captions). Max 6 frames to save tokens.',
            parameters: {
                type: 'object',
                properties: {
                    timestamps: {
                        type: 'array',
                        items: { type: 'number' },
                        description: 'Array of timestamps in seconds to capture frames at (e.g. [0, 2, 5, 8]). Max 6 timestamps.',
                    },
                },
                required: ['timestamps'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'cut_time_range',
            description: 'Remove a specific time range from a clip on the timeline. Splits the clip at start and end times, then deletes the middle segment. Use this to remove silence gaps, unwanted sections, or trim parts of a video/audio clip.',
            parameters: {
                type: 'object',
                properties: {
                    itemId: {
                        type: 'string',
                        description: 'The ID of the timeline item (video/audio clip) to cut from. Use get_timeline_info to find IDs.',
                    },
                    startSec: {
                        type: 'number',
                        description: 'Start time in seconds of the range to remove.',
                    },
                    endSec: {
                        type: 'number',
                        description: 'End time in seconds of the range to remove.',
                    },
                },
                required: ['itemId', 'startSec', 'endSec'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'select_items_by_id',
            description: 'Select specific timeline items by their IDs.',
            parameters: {
                type: 'object',
                properties: {
                    itemIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of item IDs to select.',
                    },
                },
                required: ['itemIds'],
            },
        },
    },
    {
        type: 'function',
        function: {
            name: 'move_items_by_id',
            description: 'Move specific items by their IDs.',
            parameters: {
                type: 'object',
                properties: {
                    itemIds: {
                        type: 'array',
                        items: { type: 'string' },
                        description: 'List of item IDs to move.',
                    },
                    deltaFrames: {
                        type: 'number',
                        description: 'Number of frames to move.',
                    },
                },
                required: ['itemIds', 'deltaFrames'],
            },
        },
    },
];
