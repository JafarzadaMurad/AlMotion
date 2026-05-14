import { useState, useRef, useEffect, memo, useCallback, useMemo } from 'react';
import { Send, Bot, User, Loader2, Trash2, AlertCircle, ChevronDown, Square, Video, Music, Type, Plus, MessageSquarePlus, History, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useAiChatStore } from '@/features/editor/stores/ai-chat-store';
import { useProjectStore } from '@/features/editor/deps/projects';
import { OpenAiService } from '@/infrastructure/ai/openai-service';
import { AiToolExecutor } from '@/infrastructure/ai/ai-tool-executor';
import { AI_TOOLS } from '@/infrastructure/ai/ai-tool-definitions';
import { ApiClient } from '@/infrastructure/api/api-client';
import { cn } from '@/shared/ui/cn';
import { mediaLibraryService } from '@/features/media-library/services/media-library-service';
import { useSelectionStore } from '@/features/editor/stores/selection-store';
import { useTimelineStore } from '@/features/editor/deps/timeline-store';

const MODEL_LABELS: Record<string, string> = {
    'gpt-4.1': 'GPT-4.1',
    'gpt-4.1-mini': 'GPT-4.1 Mini',
    'gpt-4o': 'GPT-4o',
    'gpt-4o-mini': 'GPT-4o Mini',
    'o4-mini': 'o4 Mini',
    'o3-mini': 'o3 Mini',
    'gpt-5': 'GPT-5',
    'gpt-5-mini': 'GPT-5 mini',
    'gpt-5-nano': 'GPT-5 nano',
    'gpt-5.4': 'GPT-5.4',
    'gpt-5.4-pro': 'GPT-5.4 pro',
    'gpt-5.4-mini': 'GPT-5.4 mini',
    'gpt-5.4-nano': 'GPT-5.4 nano',
};

export const AiChatPanel = memo(function AiChatPanel() {
    const {
        messages,
        isGenerating,
        setGenerating,
        clearHistory,
        error,
        setError,
        selectedModel,
        setSelectedModel,
        availableModels,
        setAvailableModels,
        abortGeneration,
        setAbortController,
        selectedAgentId,
        setSelectedAgent,
        agents,
        setAgents,
        // Session
        sessions,
        activeSessionId,
        loadSessions,
        createNewSession,
        switchSession,
        deleteSessionById,
        addSessionMessage,
        hasMoreMessages,
        isLoadingHistory,
        loadMoreMessages,
        pendingUserInput,
        clearPendingUserInput,
    } = useAiChatStore();

    const currentProjectId = useProjectStore((s) => s.currentProject?.id);
    const [showSessionList, setShowSessionList] = useState(false);

    // Load sessions when project changes — always open the latest session
    useEffect(() => {
        if (!currentProjectId) return;
        loadSessions(currentProjectId).then(() => {
            const { sessions: s } = useAiChatStore.getState();
            if (s.length === 0) {
                createNewSession(currentProjectId);
            } else {
                // Always open the most recent session (sorted by latest first from backend)
                switchSession(currentProjectId, s[0]!.id);
            }
        });
    }, [currentProjectId, loadSessions, switchSession, createNewSession]);

    useEffect(() => {
        ApiClient.get<{ available_models: string[]; default_model: string; pexels_api_key?: string; ai_system_prompt?: string; ai_rules?: string[] }>('/user/ai-config')
            .then((data) => {
                setAvailableModels(data.available_models);
                if (!data.available_models.includes(useAiChatStore.getState().selectedModel)) {
                    setSelectedModel(data.default_model);
                }
                executor.current.setApiKeys('proxy-token', data.pexels_api_key || null);

                // Load admin-configured system prompt and rules
                useAiChatStore.getState().setAdminSystemPrompt(data.ai_system_prompt || null);
                useAiChatStore.getState().setAdminRules(data.ai_rules || []);
                useAiChatStore.getState().setAdminToolDescriptions((data as any).ai_tool_descriptions || {});
            })
            .catch(() => {});
    }, [setAvailableModels, setSelectedModel]);

    // Fetch agents on mount
    useEffect(() => {
        ApiClient.get<any[]>('/agents')
            .then((data) => setAgents(data))
            .catch(() => {});
    }, [setAgents]);

    const [input, setInput] = useState('');
    const [showModelMenu, setShowModelMenu] = useState(false);
    const [showAgentMenu, setShowAgentMenu] = useState(false);
    const selectedAgent = selectedAgentId ? agents.find(a => a.id === selectedAgentId) ?? null : null;
    const [userInputText, setUserInputText] = useState('');

    const handleUserInputResponse = useCallback(async (answer: string) => {
        if (!pendingUserInput) return;
        const resolve = pendingUserInput.resolve;
        const pickerType = pendingUserInput.pickerType;
        const pickerItems = pendingUserInput.pickerItems;
        setUserInputText('');

        // Show name + ID in chat so AI can read the ID
        if (pickerType === 'avatar' || pickerType === 'voice') {
            const items = pickerItems || [];
            let displayName = answer;
            for (const item of items) {
                if (item.id === answer) { displayName = item.name; break; }
            }
            addSessionMessage({ role: 'user', content: `${displayName} [id:${answer}]` });
        } else {
            addSessionMessage({ role: 'user', content: answer });
        }

        // DON'T clear pending here — resolve may set a NEW pending (group→looks transition)
        // If resolve doesn't set new pending, the tool loop will continue and pending stays null anyway
        // We set pending to null only if resolve doesn't replace it
        console.log('[ChatPanel] handleUserInputResponse: resolving with', answer);
        clearPendingUserInput();
        await resolve(answer);
        console.log('[ChatPanel] handleUserInputResponse: resolve done, pending:', useAiChatStore.getState().pendingUserInput ? 'SET' : 'null');
    }, [pendingUserInput, addSessionMessage, clearPendingUserInput]);

    const handleUserInputSkip = useCallback(() => {
        if (!pendingUserInput) return;
        addSessionMessage({ role: 'user', content: '(skipped)' });
        pendingUserInput.resolve('skip');
        clearPendingUserInput();
        setUserInputText('');
    }, [pendingUserInput, addSessionMessage, clearPendingUserInput]);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const executor = useRef(new AiToolExecutor());

    // Selected items context
    const selectedItemIds = useSelectionStore((s) => s.selectedItemIds);
    const timelineItems = useTimelineStore((s) => s.items);
    const fps = useTimelineStore((s) => s.fps) || 30;

    const selectedItems = useMemo(() => {
        if (selectedItemIds.length === 0) return [];
        return selectedItemIds
            .map((id) => timelineItems.find((item) => item.id === id))
            .filter(Boolean) as any[];
    }, [selectedItemIds, timelineItems]);

    // Removed hardcoded API Key clear

    // Auto-scroll to bottom on new messages
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isGenerating]);

    const handleSend = useCallback(async () => {
        if (!input.trim() || isGenerating) return;

        const userMessage = input.trim();
        setInput('');

        // Capture selection snapshot at send time
        const selectionSnapshot = selectedItems.map((item) => ({
            id: item.id,
            type: item.type,
            label: item.label || '',
            startSec: +(item.from / fps).toFixed(2),
            durationSec: +(item.durationInFrames / fps).toFixed(2),
            ...(item.mediaId && { mediaId: item.mediaId }),
            ...(item.type === 'text' && { text: item.text }),
        }));

        // Encode attachments into message content for display
        const displayMessage = selectionSnapshot.length > 0
            ? `${userMessage}\n<!--attachments:${JSON.stringify(selectionSnapshot.map(s => ({ type: s.type, label: s.label || s.text || s.type, mediaId: s.mediaId, durSec: s.durationSec })))}-->`
            : userMessage;

        addSessionMessage({ role: 'user', content: displayMessage });
        setGenerating(true);
        setError(null);

        const model = useAiChatStore.getState().selectedModel;
        const service = new OpenAiService('');

        const ac = new AbortController();
        setAbortController(ac);

        try {
            let chatHistory = useAiChatStore.getState().messages;
            const currentAgent = useAiChatStore.getState().selectedAgentId
                ? useAiChatStore.getState().agents.find(a => a.id === useAiChatStore.getState().selectedAgentId) ?? null
                : null;

            // Build system prompt from: admin config (base) + admin rules + agent prompt (if selected)
            const { adminSystemPrompt, adminRules } = useAiChatStore.getState();

            const basePrompt = adminSystemPrompt || 'You are an AI video editing assistant.';
            const allRules = adminRules;
            const rulesText = allRules.map((r, i) => `${i + 1}. ${r}`).join('\n');

            let fullPrompt = `${basePrompt}\n\nRULES:\n${rulesText}`;

            // If agent is selected, append agent's custom prompt
            if (currentAgent) {
                fullPrompt += `\n\nAGENT INSTRUCTIONS:\n${currentAgent.system_prompt}`;
            }

            const systemPrompt = {
                role: 'system',
                content: fullPrompt,
            };

            const { adminToolDescriptions } = useAiChatStore.getState();
            const baseTools = currentAgent?.allowed_tools
                ? AI_TOOLS.filter(t => currentAgent.allowed_tools!.includes(t.function.name))
                : AI_TOOLS;

            // Override tool descriptions from admin config
            const toolsToUse = Object.keys(adminToolDescriptions).length > 0
                ? baseTools.map(t => {
                    const customDesc = adminToolDescriptions[t.function.name];
                    if (customDesc) {
                        return { ...t, function: { ...t.function, description: customDesc } };
                    }
                    return t;
                })
                : baseTools;

            // Build the actual user message with selection context for AI
            const lastUserContent = selectionSnapshot.length > 0
                ? `[ATTACHED ITEMS]\n${JSON.stringify(selectionSnapshot, null, 2)}\n[/ATTACHED ITEMS]\n\nUser request: ${userMessage}`
                : userMessage;

            let conversation: any[] = [
                systemPrompt,
                ...chatHistory.slice(0, -1).map(m => ({ role: m.role, content: m.content })),
                { role: 'user', content: lastUserContent },
            ];

            let response = await service.chat(conversation, toolsToUse, model, ac.signal);
            let assistantMessage = response.choices[0].message;

            while (assistantMessage.tool_calls) {
                if (ac.signal.aborted) throw new Error('AbortError');

                // DYNAMIC OUTPUT: If the AI includes a thinking/speaking message during a tool call, display it immediately
                if (assistantMessage.content) {
                    addSessionMessage({ role: 'assistant', content: assistantMessage.content });
                }

                conversation.push(assistantMessage);
                const toolCalls = assistantMessage.tool_calls;
                // Collect vision frames here and only inject the user-role image message AFTER
                // every tool_call has been answered. OpenAI rejects the next request when the
                // tool responses for one assistant message are interleaved with other roles
                // ("tool_call_ids did not have response messages").
                const pendingVisionFrames: any[] = [];

                for (const toolCall of toolCalls) {
                    if (ac.signal.aborted) throw new Error('AbortError');
                    const toolName = toolCall.function.name;

                    // Synthesize intermediate messages for long-running tools
                    let interimMsg = '';
                    let argsText = '';
                    try { const a = JSON.parse(toolCall.function.arguments); argsText = a.query || ''; } catch { }

                    if (toolName === 'transcribe_media') interimMsg = 'Videonu transkripsiya edirəm, zəhmət olmasa gözləyin...';
                    else if (toolName === 'search_and_import_pexels') interimMsg = `Mövzuya uyğun kadrlar axtarıram${argsText ? ` ("${argsText}")` : ''}...`;
                    else if (toolName === 'add_captions') interimMsg = 'Altyazıları timeline-a əlavə edirəm...';
                    else if (toolName === 'capture_current_frame') interimMsg = 'Ekrandakı kadra baxıram...';
                    else if (toolName === 'capture_video_frames') interimMsg = 'Videodan kadrlar çıxarıram və analiz edirəm...';
                    else if (toolName === 'generate_ai_broll') interimMsg = 'AI ilə B-Roll video generasiya edirəm (30-60 saniyə çəkə bilər)...';

                    if (interimMsg) {
                        addSessionMessage({ role: 'assistant', content: interimMsg });
                        await new Promise(resolve => setTimeout(resolve, 50)); // allow React to re-render UI
                    }

                    const result = await executor.current.execute(toolCall);

                    // Check if tool returned vision frames
                    let visionFrames: any[] | null = null;
                    try {
                        const parsed = JSON.parse(result);
                        if (parsed.type === 'vision_frames' && parsed.frames?.length > 0) {
                            visionFrames = parsed.frames;
                            console.log(`[AI Vision] Captured ${parsed.frames.length} frame(s), sizes: ${parsed.frames.map((f: any) => Math.round(f.dataUrl.length / 1024) + 'KB').join(', ')}`);
                            // Log frames as viewable images in console
                            parsed.frames.forEach((f: any, idx: number) => {
                                const img = new Image();
                                img.src = f.dataUrl;
                                img.onload = () => {
                                    const c = document.createElement('canvas');
                                    c.width = Math.min(img.width, 300);
                                    c.height = Math.round(img.height * (c.width / img.width));
                                    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
                                    console.log(`[AI Vision] Frame ${idx + 1} (${f.timestamp}s):`);
                                    console.log('%c ', `font-size:1px; padding:${c.height / 2}px ${c.width / 2}px; background:url(${c.toDataURL()}) no-repeat; background-size:contain;`);
                                };
                            });
                        }
                    } catch { /* not JSON, use as string */ }

                    // Tool response must be string — OpenAI doesn't support images in tool role
                    conversation.push({
                        role: 'tool',
                        tool_call_id: toolCall.id,
                        name: toolCall.function.name,
                        content: visionFrames
                            ? `Captured ${visionFrames.length} frame(s) at timestamps: ${visionFrames.map((f: any) => f.timestamp + 's').join(', ')}. The images are attached in the next user message for your analysis.`
                            : result,
                    });

                    // Defer the user-role image push — see pendingVisionFrames declaration.
                    if (visionFrames) {
                        pendingVisionFrames.push(...visionFrames);
                    }
                }

                // All tool_call_ids have been answered above. Now we can append a single
                // user-role image message carrying every captured frame from this turn.
                if (pendingVisionFrames.length > 0) {
                    const imageBlocks = pendingVisionFrames.map((f: any) => ({
                        type: 'image_url',
                        image_url: { url: f.dataUrl, detail: 'high' },
                    }));
                    conversation.push({
                        role: 'user',
                        content: [
                            // The previous prompt asked for a long visual description, which made the
                            // model write paragraphs about clothing/colors instead of executing the
                            // user's actual request. We now tell it to use the frames to PERFORM the
                            // task and respond in the user's language with a single short confirmation.
                            { type: 'text', text: `These frames are reference data, NOT the deliverable. Use them silently to complete the user's original request — call the appropriate tools right now (e.g. update_item_style with positionY for caption placement). Do NOT write a description of what you see. Reply in the same language the user used, in ONE short sentence after the action is done.` },
                            ...imageBlocks,
                        ],
                    });
                }

                if (ac.signal.aborted) throw new Error('AbortError');
                response = await service.runToolCompletion(conversation, toolsToUse, model, ac.signal);
                assistantMessage = response.choices[0].message;
            }

            if (assistantMessage.content) {
                addSessionMessage({ role: 'assistant', content: assistantMessage.content });
            } else if (conversation[conversation.length - 1]?.role === 'tool') {
                // If it just silently finished tools without a wrap-up message, it's fine,
                // but we check if the last thing was a tool call.
            }
        } catch (err: any) {
            if (err.name === 'AbortError' || err.message === 'AbortError') {
                return; // Gracefully handle abort without showing error
            }
            setError(err instanceof Error ? err.message : 'An error occurred');
            addSessionMessage({ role: 'assistant', content: 'Sorry, an error occurred while executing your request.' });
        } finally {
            setGenerating(false);
            setAbortController(null);
        }
    }, [input, isGenerating, addSessionMessage, setGenerating, setError, setAbortController]);

    return (
        <div className="flex flex-col h-full bg-background border-l border-border">
            {/* Header */}
            <div className="p-2 border-b border-border flex items-center justify-between bg-secondary/20">
                <div className="flex items-center gap-1.5 flex-1 min-w-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 shrink-0"
                        onClick={() => setShowSessionList(v => !v)}
                        title="Chat history"
                    >
                        <History className="w-3.5 h-3.5" />
                    </Button>
                    <span className="text-xs text-muted-foreground truncate">
                        {sessions.find(s => s.id === activeSessionId)?.title ?? 'AI Assistant'}
                    </span>
                </div>
                <div className="flex items-center gap-0.5 shrink-0">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => currentProjectId && createNewSession(currentProjectId)}
                        title="New chat"
                    >
                        <MessageSquarePlus className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={clearHistory} title="Clear">
                        <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                </div>
            </div>

            {/* Session list sidebar */}
            {showSessionList && (
                <div className="border-b border-border bg-secondary/10 max-h-48 overflow-y-auto">
                    <div className="p-1.5 space-y-0.5">
                        {sessions.map((session) => (
                            <div
                                key={session.id}
                                onClick={() => {
                                    if (currentProjectId) switchSession(currentProjectId, session.id);
                                    setShowSessionList(false);
                                }}
                                className={cn(
                                    "w-full text-left px-2.5 py-1.5 rounded-md text-xs transition-colors flex items-center justify-between group cursor-pointer",
                                    session.id === activeSessionId
                                        ? "bg-primary/10 text-primary font-medium"
                                        : "text-muted-foreground hover:bg-secondary/60"
                                )}
                            >
                                <span className="truncate flex-1">{session.title}</span>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (currentProjectId) deleteSessionById(currentProjectId, session.id);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-destructive transition-opacity shrink-0 ml-1"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                        {sessions.length === 0 && (
                            <p className="text-[10px] text-muted-foreground/50 text-center py-2">No chats yet</p>
                        )}
                    </div>
                </div>
            )}

            {/* Messages Area */}
            <ScrollArea className="flex-1 p-3" onScrollCapture={(e) => {
                const target = e.target as HTMLElement;
                if (target.scrollTop < 50 && hasMoreMessages && !isLoadingHistory) {
                    loadMoreMessages();
                }
            }}>
                <div ref={scrollRef} className="space-y-4">
                    {isLoadingHistory && (
                        <div className="flex justify-center py-2">
                            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {messages.length === 0 && !isGenerating && (
                        <div className="flex flex-col items-center justify-center py-12 text-center space-y-3 text-muted-foreground">
                            <Bot className="w-12 h-12 opacity-20" />
                            <div className="space-y-1">
                                <p className="text-sm font-medium">Hello! I am your AI video assistant.</p>
                                <p className="text-xs">Ask me to "split clips", "add text", or "generate b-rolls".</p>
                            </div>
                        </div>
                    )}

                    {messages.filter(m => m.role !== 'system').map((m) => (
                        <div key={m.id} className={cn("flex gap-2 max-w-[90%]", m.role === 'user' ? "ml-auto flex-row-reverse" : "mr-auto")}>
                            <div className={cn(
                                "w-7 h-7 rounded-full flex items-center justify-center shrink-0 border",
                                m.role === 'user' ? "bg-secondary" : "bg-primary/10 border-primary/20"
                            )}>
                                {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5 text-primary" />}
                            </div>
                            <div className={cn(
                                "rounded-2xl text-sm leading-relaxed",
                                m.role === 'user' ? "bg-primary text-primary-foreground rounded-tr-none" : "bg-secondary/50 rounded-tl-none border border-border"
                            )}>
                                <MessageContent content={m.content} isUser={m.role === 'user'} />
                            </div>
                        </div>
                    ))}

                    {isGenerating && (
                        <div className="flex flex-col gap-2 mr-auto max-w-[90%]">
                            <div className="flex gap-2">
                                <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                    <Bot className="w-3.5 h-3.5 text-primary" />
                                </div>
                                <div className="bg-secondary/50 p-2.5 rounded-2xl rounded-tl-none border border-border flex items-center gap-2">
                                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                                    <span className="text-sm italic text-muted-foreground animate-pulse">Thinking...</span>
                                </div>
                            </div>
                            {useAiChatStore.getState().interimStatus && (
                                <div className="ml-9 text-[10px] text-muted-foreground bg-secondary/30 px-2 py-1 rounded-md border border-border/50 animate-in fade-in slide-in-from-top-1">
                                    {useAiChatStore.getState().interimStatus}
                                </div>
                            )}
                        </div>
                    )}

                    {error && (
                        <div className="flex items-start gap-2 p-3 rounded-lg border border-destructive/20 bg-destructive/5 text-destructive text-xs">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            <p>{error}</p>
                        </div>
                    )}

                    {/* Interactive picker / quick-reply when AI asks */}
                    {pendingUserInput && (
                        <div className="mr-auto max-w-[95%]">
                            {/* Avatar picker — grid with search */}
                            {pendingUserInput.pickerType === 'avatar' && pendingUserInput.pickerItems && (
                                <AvatarPickerGrid
                                    items={pendingUserInput.pickerItems}
                                    onSelect={handleUserInputResponse}
                                    onSkip={handleUserInputSkip}
                                />
                            )}

                            {/* Voice picker — paginated list with filters + audio play */}
                            {pendingUserInput.pickerType === 'voice' && pendingUserInput.pickerItems && (
                                <VoicePickerList
                                    items={pendingUserInput.pickerItems}
                                    onSelect={handleUserInputResponse}
                                    onSkip={handleUserInputSkip}
                                />
                            )}

                            {/* Default: text options + free input (ask_user) */}
                            {!pendingUserInput.pickerType && (
                                <div className="flex gap-2">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                                        <Bot className="w-3.5 h-3.5 text-primary" />
                                    </div>
                                    <div className="space-y-2">
                                        {pendingUserInput.options && pendingUserInput.options.length > 0 && (
                                            <div className="flex flex-wrap gap-1.5">
                                                {pendingUserInput.options.map((opt) => (
                                                    <button
                                                        key={opt}
                                                        onClick={() => handleUserInputResponse(opt)}
                                                        className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                                                    >
                                                        {opt}
                                                    </button>
                                                ))}
                                            </div>
                                        )}
                                        <div className="flex gap-1.5">
                                            <form onSubmit={(e) => { e.preventDefault(); if (userInputText.trim()) handleUserInputResponse(userInputText.trim()); }} className="flex gap-1.5">
                                                <input
                                                    value={userInputText}
                                                    onChange={(e) => setUserInputText(e.target.value)}
                                                    placeholder="Cavabınızı yazın..."
                                                    autoFocus
                                                    className="px-3 py-1.5 rounded-xl border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none w-40"
                                                    onKeyDown={(e) => { if (e.key === 'Escape') handleUserInputSkip(); e.stopPropagation(); }}
                                                />
                                                <button type="submit" disabled={!userInputText.trim()} className="px-2.5 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50">
                                                    <Send className="w-3 h-3" />
                                                </button>
                                            </form>
                                            <button onClick={handleUserInputSkip} className="px-2.5 py-1.5 rounded-xl border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/40 transition-colors">
                                                Skip
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                </div>
            </ScrollArea>

            {/* Input Area */}
            <div className="p-3 border-t border-border bg-secondary/10 space-y-2">
                {/* Selection context chips — show max 3, expandable */}
                {selectedItems.length > 0 && (
                    <SelectionChipsBar items={selectedItems} fps={fps} selectedItemIds={selectedItemIds} />
                )}

                {/* Agent + Model selectors */}
                <div className="flex items-center gap-2">
                    {/* Agent selector */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowAgentMenu((v) => !v); setShowModelMenu(false); }}
                            disabled={isGenerating}
                            className={cn(
                                "flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-colors text-xs disabled:opacity-50",
                                selectedAgent
                                    ? "border-purple-500/40 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                                    : "border-border bg-background text-muted-foreground hover:bg-secondary/40"
                            )}
                        >
                            <Bot className="w-3 h-3" />
                            <span className="font-medium truncate max-w-[100px]">{selectedAgent?.name ?? 'Default'}</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        {showAgentMenu && (
                            <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[180px] max-h-[280px] overflow-y-auto rounded-lg border border-border bg-popover shadow-lg">
                                <button
                                    onClick={() => { setSelectedAgent(null); setShowAgentMenu(false); }}
                                    className={cn(
                                        "w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 transition-colors flex items-center gap-2",
                                        !selectedAgentId ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                                    )}
                                >
                                    <Bot className="w-3.5 h-3.5" />
                                    Default Assistant
                                </button>

                                {agents.filter(a => a.is_global).length > 0 && (
                                    <>
                                        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 border-t border-border">Global</div>
                                        {agents.filter(a => a.is_global).map((agent) => (
                                            <button
                                                key={agent.id}
                                                onClick={() => { setSelectedAgent(agent.id); setShowAgentMenu(false); }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 transition-colors",
                                                    agent.id === selectedAgentId ? "text-purple-300 font-semibold bg-purple-500/10" : "text-foreground"
                                                )}
                                            >
                                                <div className="font-medium">{agent.name}</div>
                                                {agent.description && <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{agent.description}</div>}
                                            </button>
                                        ))}
                                    </>
                                )}

                                {agents.filter(a => a.is_own).length > 0 && (
                                    <>
                                        <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground/50 border-t border-border">My Agents</div>
                                        {agents.filter(a => a.is_own).map((agent) => (
                                            <button
                                                key={agent.id}
                                                onClick={() => { setSelectedAgent(agent.id); setShowAgentMenu(false); }}
                                                className={cn(
                                                    "w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 transition-colors",
                                                    agent.id === selectedAgentId ? "text-purple-300 font-semibold bg-purple-500/10" : "text-foreground"
                                                )}
                                            >
                                                <div className="font-medium">{agent.name}</div>
                                                {agent.description && <div className="text-[10px] text-muted-foreground/60 mt-0.5 truncate">{agent.description}</div>}
                                            </button>
                                        ))}
                                    </>
                                )}

                                {/* Create new agent / manage agents */}
                                <div className="border-t border-border flex">
                                    <a
                                        href="/agents/new"
                                        target="_blank"
                                        onClick={() => setShowAgentMenu(false)}
                                        className="flex-1 text-center px-3 py-2 text-xs text-purple-400 hover:bg-purple-500/10 transition-colors flex items-center justify-center gap-1"
                                    >
                                        <Plus className="w-3 h-3" />
                                        New
                                    </a>
                                    <a
                                        href="/agents"
                                        target="_blank"
                                        onClick={() => setShowAgentMenu(false)}
                                        className="flex-1 text-center px-3 py-2 text-xs text-muted-foreground hover:bg-secondary/60 transition-colors border-l border-border"
                                    >
                                        Manage
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Model selector */}
                    <div className="relative">
                        <button
                            onClick={() => { setShowModelMenu((v) => !v); setShowAgentMenu(false); }}
                            disabled={isGenerating}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-background hover:bg-secondary/40 transition-colors text-xs text-muted-foreground disabled:opacity-50"
                        >
                            <span className="font-medium text-foreground">{MODEL_LABELS[selectedModel] ?? selectedModel}</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        {showModelMenu && (
                            <div className="absolute bottom-full mb-1 left-0 z-50 min-w-[160px] rounded-lg border border-border bg-popover shadow-lg overflow-hidden">
                                {availableModels.map((m) => (
                                    <button
                                        key={m}
                                        onClick={() => { setSelectedModel(m); setShowModelMenu(false); }}
                                        className={cn(
                                            "w-full text-left px-3 py-2 text-xs hover:bg-secondary/60 transition-colors",
                                            m === selectedModel ? "text-primary font-semibold bg-primary/10" : "text-foreground"
                                        )}
                                    >
                                        {MODEL_LABELS[m] ?? m}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <form onSubmit={(e) => { e.preventDefault(); handleSend(); }} className="flex gap-2">
                        <Input
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type a request..."
                            disabled={isGenerating}
                            className="flex-1 h-9 bg-background focus:ring-1"
                        />
                        {isGenerating ? (
                            <Button type="button" onClick={abortGeneration} size="icon" className="h-9 w-9 shrink-0 shadow-sm bg-destructive hover:bg-destructive/90">
                                <Square className="w-3.5 h-3.5 fill-current" />
                            </Button>
                        ) : (
                            <Button type="submit" size="icon" disabled={!input.trim()} className="h-9 w-9 shrink-0 shadow-sm">
                                <Send className="w-4 h-4" />
                            </Button>
                        )}
                    </form>
            </div>

        </div>
    );
});

function MessageContent({ content, isUser }: { content: string; isUser: boolean }) {
    const attachMatch = content.match(/<!--attachments:(.*?)-->/s);
    const text = content.replace(/\n?<!--attachments:.*?-->/s, '').trim();
    const [showAttach, setShowAttach] = useState(false);

    let attachments: Array<{ type: string; label: string; mediaId?: string; durSec: number }> = [];
    if (attachMatch) {
        try { attachments = JSON.parse(attachMatch[1]!); } catch { /* ignore */ }
    }

    return (
        <div className="p-2.5">
            <div>{text}</div>
            {isUser && attachments.length > 0 && (
                <div className="mt-1.5">
                    <button
                        onClick={() => setShowAttach(v => !v)}
                        className="text-[10px] opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1"
                    >
                        <ChevronDown className={cn("w-3 h-3 transition-transform", showAttach && "rotate-180")} />
                        {attachments.length} attachment{attachments.length > 1 ? 's' : ''}
                    </button>
                    {showAttach && (
                        <div className="mt-1 flex flex-wrap gap-1">
                            {attachments.map((a, i) => (
                                <AttachmentBadge key={i} attachment={a} />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

function AttachmentBadge({ attachment }: { attachment: { type: string; label: string; mediaId?: string; durSec: number } }) {
    const [thumbUrl, setThumbUrl] = useState<string | null>(null);
    const isVisual = attachment.type === 'video' || attachment.type === 'image';

    useEffect(() => {
        if (!isVisual || !attachment.mediaId) return;
        let mounted = true;
        mediaLibraryService.getThumbnailBlobUrl(attachment.mediaId).then((url) => {
            if (mounted && url) setThumbUrl(url);
        });
        return () => { mounted = false; };
    }, [attachment.mediaId, isVisual]);

    const TypeIcon = attachment.type === 'audio' ? Music : attachment.type === 'text' ? Type : Video;

    return (
        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/10 text-[10px]">
            {thumbUrl ? (
                <img src={thumbUrl} alt="" className="w-6 h-4 rounded object-cover" />
            ) : (
                <TypeIcon className="w-3 h-3 opacity-60" />
            )}
            <span className="truncate max-w-[60px]">{attachment.label}</span>
            <span className="opacity-50">{attachment.durSec}s</span>
        </div>
    );
}

function AvatarCard({ item, onClick }: { item: { id: string; name: string; preview_image?: string }; onClick: () => void }) {
    const [orientation, setOrientation] = useState<'portrait' | 'landscape' | 'square'>('portrait');

    return (
        <button onClick={onClick}
            className="rounded-xl border border-border bg-secondary/30 hover:border-primary/50 hover:bg-secondary/50 transition-all overflow-hidden flex flex-col">
            <div className="w-full aspect-[3/4] relative bg-zinc-900 flex items-center justify-center overflow-hidden">
                {item.preview_image ? (
                    <img
                        src={item.preview_image}
                        alt={item.name}
                        className={`${orientation === 'portrait' ? 'w-full h-full object-cover' : 'max-w-full max-h-full object-contain'}`}
                        onLoad={(e) => {
                            const img = e.target as HTMLImageElement;
                            const ratio = img.naturalWidth / img.naturalHeight;
                            if (ratio > 1.2) setOrientation('landscape');
                            else if (ratio < 0.8) setOrientation('portrait');
                            else setOrientation('square');
                        }}
                    />
                ) : (
                    <User className="w-6 h-6 text-muted-foreground/30" />
                )}
                {orientation !== 'portrait' && (
                    <span className="absolute top-1 right-1 text-[8px] bg-black/60 text-white px-1 rounded">
                        {orientation === 'landscape' ? '16:9' : '1:1'}
                    </span>
                )}
            </div>
            <p className="text-[10px] text-center py-1 px-1 truncate text-foreground w-full">{item.name}</p>
        </button>
    );
}

function VoicePickerList({ items, onSelect, onSkip }: {
    items: Array<{ id: string; name: string; preview_audio?: string; subtitle?: string; gender?: string }>;
    onSelect: (id: string) => void;
    onSkip: () => void;
}) {
    const [search, setSearch] = useState('');
    const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
    const [langFilter, setLangFilter] = useState('');
    const [page, setPage] = useState(0);
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const PAGE_SIZE = 6;

    // Extract unique languages
    const languages = [...new Set(items.map(i => (i.subtitle?.split('·')[0] || '').trim()).filter(Boolean))].sort();

    const filtered = items.filter(i => {
        if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (genderFilter !== 'all') {
            const g = (i.gender || i.subtitle || '').toLowerCase();
            if (!g.includes(genderFilter)) return false;
        }
        if (langFilter) {
            const lang = (i.subtitle || '').toLowerCase();
            if (!lang.includes(langFilter.toLowerCase())) return false;
        }
        return true;
    });

    const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
    const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const playAudio = (url: string, id: string) => {
        if (audioRef.current) { audioRef.current.pause(); }
        if (playingId === id) { setPlayingId(null); return; }
        const audio = new Audio(url);
        audioRef.current = audio;
        setPlayingId(id);
        audio.play();
        audio.onended = () => setPlayingId(null);
    };

    return (
        <div className="space-y-2">
            {/* Filters */}
            <div className="flex gap-1.5">
                <input
                    type="text"
                    value={search}
                    onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                    placeholder="Səs axtar..."
                    className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                />
                <div className="flex rounded-lg border border-border overflow-hidden">
                    {(['all', 'female', 'male'] as const).map(g => (
                        <button key={g} onClick={() => { setGenderFilter(g); setPage(0); }}
                            className={cn('px-2 py-1.5 text-[10px] transition-colors', genderFilter === g ? 'bg-primary/20 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary/40')}>
                            {g === 'all' ? 'All' : g === 'female' ? '♀' : '♂'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Language filter */}
            {languages.length > 1 && (
                <div className="flex gap-1 flex-wrap">
                    <button onClick={() => { setLangFilter(''); setPage(0); }}
                        className={cn('px-2 py-0.5 rounded-full text-[9px] transition-colors', !langFilter ? 'bg-primary/20 text-primary' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60')}>
                        All
                    </button>
                    {languages.slice(0, 8).map(l => (
                        <button key={l} onClick={() => { setLangFilter(l); setPage(0); }}
                            className={cn('px-2 py-0.5 rounded-full text-[9px] transition-colors', langFilter === l ? 'bg-primary/20 text-primary' : 'bg-secondary/40 text-muted-foreground hover:bg-secondary/60')}>
                            {l}
                        </button>
                    ))}
                </div>
            )}

            {/* Voice list */}
            <div className="space-y-1">
                {visible.map((item) => (
                    <div key={item.id} onClick={() => onSelect(item.id)}
                        className="flex items-center gap-2.5 p-2 rounded-lg border border-border bg-secondary/20 hover:border-primary/40 hover:bg-secondary/40 cursor-pointer transition-all">
                        <button
                            onClick={(e) => { e.stopPropagation(); if (item.preview_audio) playAudio(item.preview_audio, item.id); }}
                            disabled={!item.preview_audio}
                            className={cn('w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors',
                                !item.preview_audio ? 'bg-zinc-800 text-zinc-600' :
                                playingId === item.id ? 'bg-primary/30 text-primary' : 'bg-primary/15 text-primary hover:bg-primary/25')}
                        >
                            <span className="text-xs">{playingId === item.id ? '⏸' : '▶'}</span>
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{item.name}</p>
                            {item.subtitle && <p className="text-[10px] text-muted-foreground/60">{item.subtitle}</p>}
                        </div>
                    </div>
                ))}
                {visible.length === 0 && <p className="text-[10px] text-muted-foreground/50 text-center py-2">Səs tapılmadı</p>}
            </div>

            <PickerPagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
            <button onClick={onSkip} className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground">Skip</button>
        </div>
    );
}

function PickerPagination({ page, totalPages, onPrev, onNext }: { page: number; totalPages: number; onPrev: () => void; onNext: () => void }) {
    if (totalPages <= 1) return null;
    return (
        <div className="flex items-center justify-between">
            <button onClick={onPrev} disabled={page === 0} className="text-[10px] text-primary/70 hover:text-primary disabled:opacity-30">← Əvvəlki</button>
            <span className="text-[10px] text-muted-foreground/50">{page + 1} / {totalPages}</span>
            <button onClick={onNext} disabled={page >= totalPages - 1} className="text-[10px] text-primary/70 hover:text-primary disabled:opacity-30">Növbəti →</button>
        </div>
    );
}

function AvatarPickerGrid({ items, onSelect, onSkip }: {
    items: Array<{ id: string; name: string; preview_image?: string; gender?: string; looks?: Array<{ id: string; name: string; preview_image?: string }> }>;
    onSelect: (id: string) => void;
    onSkip: () => void;
}) {
    const [search, setSearch] = useState('');
    const [genderFilter, setGenderFilter] = useState<'all' | 'male' | 'female'>('all');
    const [page, setPage] = useState(0);
    const [selectedGroup, setSelectedGroup] = useState<typeof items[0] | null>(null);
    const [looksPage, setLooksPage] = useState(0);
    const PAGE_SIZE = 6;

    // Group view
    if (!selectedGroup) {
        const filtered = items.filter(i => {
            if (search && !i.name.toLowerCase().includes(search.toLowerCase())) return false;
            if (genderFilter !== 'all' && i.gender && i.gender.toLowerCase() !== genderFilter) return false;
            return true;
        });
        const totalPages = Math.ceil(filtered.length / PAGE_SIZE);
        const visible = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

        return (
            <div className="space-y-2">
                <div className="flex gap-1.5">
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => { setSearch(e.target.value); setPage(0); }}
                        placeholder="Avatar axtar..."
                        className="flex-1 px-3 py-1.5 rounded-lg border border-border bg-background text-xs text-foreground focus:border-primary focus:outline-none"
                    />
                    <div className="flex rounded-lg border border-border overflow-hidden">
                        {(['all', 'female', 'male'] as const).map(g => (
                            <button key={g} onClick={() => { setGenderFilter(g); setPage(0); }}
                                className={cn('px-2 py-1.5 text-[10px] transition-colors', genderFilter === g ? 'bg-primary/20 text-primary font-medium' : 'text-muted-foreground hover:bg-secondary/40')}>
                                {g === 'all' ? 'All' : g === 'female' ? '♀' : '♂'}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-1.5">
                    {page === 0 && (
                        <button onClick={() => { const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/*'; input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) onSelect(`upload:${f.name}`); }; input.click(); }}
                            className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-colors flex flex-col items-center justify-center gap-1 p-3 aspect-[3/4]">
                            <Plus className="w-5 h-5 text-primary/60" />
                            <span className="text-[9px] text-primary/60 text-center leading-tight">Şəklimi yüklə</span>
                        </button>
                    )}
                    {visible.map((item) => (
                        <AvatarCard key={item.id} item={item} onClick={() => {
                            if (item.looks && item.looks.length > 1) { setSelectedGroup(item); setLooksPage(0); }
                            else if (item.looks && item.looks.length === 1) { onSelect(item.looks[0]!.id); }
                            else { onSelect(item.id); }
                        }} />
                    ))}
                </div>

                <PickerPagination page={page} totalPages={totalPages} onPrev={() => setPage(p => p - 1)} onNext={() => setPage(p => p + 1)} />
                <button onClick={onSkip} className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground">Skip</button>
            </div>
        );
    }

    // Looks view (inside a group)
    const looks = selectedGroup.looks || [];
    const looksTotalPages = Math.ceil(looks.length / PAGE_SIZE);
    const visibleLooks = looks.slice(looksPage * PAGE_SIZE, (looksPage + 1) * PAGE_SIZE);

    return (
        <div className="space-y-2">
            <button onClick={() => setSelectedGroup(null)} className="flex items-center gap-1 text-[11px] text-primary/70 hover:text-primary">
                ← {selectedGroup.name} — Geri
            </button>

            <div className="grid grid-cols-3 gap-1.5">
                {visibleLooks.map((look) => (
                    <AvatarCard key={look.id} item={look} onClick={() => onSelect(look.id)} />
                ))}
            </div>

            <PickerPagination page={looksPage} totalPages={looksTotalPages} onPrev={() => setLooksPage(p => p - 1)} onNext={() => setLooksPage(p => p + 1)} />
            <button onClick={onSkip} className="text-[10px] text-muted-foreground/60 hover:text-muted-foreground">Skip</button>
        </div>
    );
}

function SelectionChipsBar({ items, fps, selectedItemIds }: { items: any[]; fps: number; selectedItemIds: string[] }) {
    const [expanded, setExpanded] = useState(false);
    const MAX_VISIBLE = 3;
    const visibleItems = expanded ? items : items.slice(0, MAX_VISIBLE);
    const hiddenCount = items.length - MAX_VISIBLE;

    return (
        <div className="space-y-1.5">
            <div className="flex flex-wrap gap-1.5">
                {visibleItems.map((item) => (
                    <SelectionChip
                        key={item.id}
                        item={item}
                        fps={fps}
                        onRemove={() => useSelectionStore.getState().selectItems(selectedItemIds.filter((id) => id !== item.id))}
                    />
                ))}
                {!expanded && hiddenCount > 0 && (
                    <button
                        onClick={() => setExpanded(true)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-700 bg-zinc-800/50 text-[11px] text-muted-foreground hover:text-white transition-colors"
                    >
                        +{hiddenCount} more
                    </button>
                )}
                {expanded && hiddenCount > 0 && (
                    <button
                        onClick={() => setExpanded(false)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg border border-zinc-700 bg-zinc-800/50 text-[11px] text-muted-foreground hover:text-white transition-colors"
                    >
                        Show less
                    </button>
                )}
            </div>
        </div>
    );
}

function SelectionChip({ item, fps, onRemove }: { item: any; fps: number; onRemove: () => void }) {
    const [thumbUrl, setThumbUrl] = useState<string | null>(null);
    const isVisual = item.type === 'video' || item.type === 'image';

    useEffect(() => {
        if (!isVisual || !item.mediaId) return;
        let mounted = true;
        mediaLibraryService.getThumbnailBlobUrl(item.mediaId).then((url) => {
            if (mounted && url) setThumbUrl(url);
        });
        return () => { mounted = false; };
    }, [item.mediaId, isVisual]);

    const durSec = (item.durationInFrames / fps).toFixed(1);

    return (
        <div className="flex items-center gap-1.5 pl-1 pr-2 py-1 rounded-lg border border-purple-500/30 bg-purple-500/10 text-[11px]">
            {thumbUrl ? (
                <img src={thumbUrl} alt="" className="w-8 h-5 rounded object-cover shrink-0" />
            ) : (
                <div className="w-5 h-5 rounded bg-secondary/50 flex items-center justify-center shrink-0">
                    {item.type === 'audio' ? <Music className="w-2.5 h-2.5 text-green-300" /> :
                     item.type === 'text' ? <Type className="w-2.5 h-2.5 text-amber-300" /> :
                     <Video className="w-2.5 h-2.5 text-blue-300" />}
                </div>
            )}
            <span className="text-purple-200 font-medium truncate max-w-[80px]">{item.label || item.type}</span>
            <span className="text-muted-foreground/50">{durSec}s</span>
            <button onClick={onRemove} className="ml-0.5 rounded-full hover:bg-white/10 p-0.5 transition-colors">
                <span className="text-muted-foreground/60 hover:text-white text-[10px] leading-none">✕</span>
            </button>
        </div>
    );
}
