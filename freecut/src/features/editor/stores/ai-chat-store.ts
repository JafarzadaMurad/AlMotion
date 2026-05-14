import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchChatMessages, saveChatMessage, fetchSessions, createSession, fetchSessionMessages, saveSessionMessage, deleteSession } from '@/infrastructure/api/chat-api';
import type { ChatSession } from '@/infrastructure/api/chat-api';

export interface Message {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: number;
}

export interface AiAgent {
    id: number;
    name: string;
    description: string | null;
    system_prompt: string;
    allowed_tools: string[] | null;
    icon: string | null;
    is_global: boolean;
    is_own: boolean;
}

interface AiChatState {
    projectId: string | null;
    messages: Message[];
    isGenerating: boolean;
    isLoadingHistory: boolean;
    openaiApiKey: string | null;
    pexelsApiKey: string | null;
    error: string | null;
    interimStatus: string | null;
    selectedModel: string;
    availableModels: string[];
    abortController: AbortController | null;
    selectedAgentId: number | null;
    agents: AiAgent[];
    adminSystemPrompt: string | null;
    adminRules: string[];
    adminToolDescriptions: Record<string, string>;
    // Session-based chat
    sessions: ChatSession[];
    activeSessionId: number | null;
    hasMoreMessages: boolean;
    currentPage: number;
    isLoadingSessions: boolean;
    pendingUserInput: {
        question: string;
        options: string[] | null;
        pickerType: 'avatar' | 'voice' | null;
        pickerItems: Array<{
            id: string;
            name: string;
            preview_image?: string;
            preview_audio?: string;
            subtitle?: string;
            gender?: string;
            looks?: Array<{ id: string; name: string; preview_image?: string }>;
        }> | null;
        resolve: (answer: string) => void | Promise<void>;
    } | null;
}

interface AiChatActions {
    setProjectId: (projectId: string) => void;
    loadMessages: (projectId: string) => Promise<void>;
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    clearHistory: () => void;
    setGenerating: (isGenerating: boolean) => void;
    setOpenaiApiKey: (key: string | null) => void;
    setPexelsApiKey: (key: string | null) => void;
    setError: (error: string | null) => void;
    setInterimStatus: (status: string | null) => void;
    setSelectedModel: (model: string) => void;
    setAvailableModels: (models: string[]) => void;
    setAbortController: (ac: AbortController | null) => void;
    abortGeneration: () => void;
    setSelectedAgent: (id: number | null) => void;
    setAgents: (agents: AiAgent[]) => void;
    setAdminSystemPrompt: (prompt: string | null) => void;
    setAdminRules: (rules: string[]) => void;
    setAdminToolDescriptions: (descs: Record<string, string>) => void;
    // Session actions
    loadSessions: (projectId: string) => Promise<void>;
    createNewSession: (projectId: string) => Promise<void>;
    switchSession: (projectId: string, sessionId: number) => Promise<void>;
    deleteSessionById: (projectId: string, sessionId: number) => Promise<void>;
    loadMoreMessages: () => Promise<void>;
    addSessionMessage: (message: Omit<Message, 'id' | 'timestamp'>) => void;
    setPendingUserInput: (input: AiChatState['pendingUserInput']) => void;
    clearPendingUserInput: () => void;
}

export const useAiChatStore = create<AiChatState & AiChatActions>()(
    persist(
        (set, get) => ({
            projectId: null,
            messages: [],
            isGenerating: false,
            isLoadingHistory: false,
            openaiApiKey: null,
            pexelsApiKey: null,
            error: null,
            interimStatus: null,
            selectedModel: 'gpt-4o-mini',
            availableModels: ['gpt-4o-mini'],
            abortController: null,
            selectedAgentId: null,
            agents: [],
            adminSystemPrompt: null,
            adminRules: [],
            adminToolDescriptions: {} as Record<string, string>,
            sessions: [],
            activeSessionId: null,
            hasMoreMessages: false,
            currentPage: 1,
            isLoadingSessions: false,
            pendingUserInput: null,

            setProjectId: (projectId) => {
                const current = get().projectId;
                if (current !== projectId) {
                    set({ projectId, messages: [] });
                }
            },

            loadMessages: async (projectId) => {
                set({ isLoadingHistory: true, projectId, messages: [] });
                try {
                    const messages = await fetchChatMessages(projectId);
                    // Only update if still on the same project
                    if (get().projectId === projectId) {
                        set({ messages, isLoadingHistory: false });
                    }
                } catch {
                    set({ isLoadingHistory: false });
                }
            },

            addMessage: (message) => {
                const localMessage: Message = {
                    ...message,
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                };

                // Optimistic: add to local state immediately
                set((state) => ({
                    messages: [...state.messages, localMessage],
                }));

                // Persist to backend (fire-and-forget)
                const projectId = get().projectId;
                if (projectId) {
                    saveChatMessage(projectId, {
                        role: message.role,
                        content: message.content,
                    }).catch(() => {
                        // Silent fail — message is visible locally
                    });
                }
            },

            clearHistory: () => set({ messages: [], error: null, interimStatus: null }),
            setGenerating: (isGenerating) => set({ isGenerating }),
            setOpenaiApiKey: (openaiApiKey) => set({ openaiApiKey }),
            setPexelsApiKey: (pexelsApiKey) => set({ pexelsApiKey }),
            setError: (error) => set({ error }),
            setInterimStatus: (interimStatus) => set({ interimStatus }),
            setSelectedModel: (selectedModel) => set({ selectedModel }),
            setAvailableModels: (availableModels) => set({ availableModels }),
            setAbortController: (ac) => set({ abortController: ac }),
            setSelectedAgent: (selectedAgentId) => set({ selectedAgentId }),
            setAgents: (agents) => set({ agents }),
            setAdminSystemPrompt: (adminSystemPrompt) => set({ adminSystemPrompt }),
            setAdminRules: (adminRules) => set({ adminRules }),
            setAdminToolDescriptions: (adminToolDescriptions) => set({ adminToolDescriptions }),

            // Session actions
            loadSessions: async (projectId) => {
                set({ isLoadingSessions: true, projectId });
                try {
                    const sessions = await fetchSessions(projectId);
                    set({ sessions, isLoadingSessions: false });
                } catch {
                    set({ isLoadingSessions: false });
                }
            },

            createNewSession: async (projectId) => {
                try {
                    const session = await createSession(projectId);
                    set((state) => ({
                        sessions: [session, ...state.sessions],
                        activeSessionId: session.id,
                        messages: [],
                        hasMoreMessages: false,
                        currentPage: 1,
                    }));
                } catch { /* silent */ }
            },

            switchSession: async (projectId, sessionId) => {
                set({ activeSessionId: sessionId, messages: [], isLoadingHistory: true, hasMoreMessages: false, currentPage: 1 });
                try {
                    const result = await fetchSessionMessages(projectId, sessionId, 1, 50);
                    set({
                        messages: result.messages,
                        hasMoreMessages: result.hasMore,
                        currentPage: result.currentPage,
                        isLoadingHistory: false,
                    });
                } catch {
                    set({ isLoadingHistory: false });
                }
            },

            deleteSessionById: async (projectId, sessionId) => {
                try {
                    await deleteSession(projectId, sessionId);
                    const { activeSessionId, sessions } = get();
                    const remaining = sessions.filter(s => s.id !== sessionId);
                    set({
                        sessions: remaining,
                        ...(activeSessionId === sessionId ? { activeSessionId: remaining[0]?.id ?? null, messages: [] } : {}),
                    });
                } catch { /* silent */ }
            },

            loadMoreMessages: async () => {
                const { projectId, activeSessionId, currentPage, hasMoreMessages, isLoadingHistory } = get();
                if (!projectId || !activeSessionId || !hasMoreMessages || isLoadingHistory) return;
                set({ isLoadingHistory: true });
                try {
                    const result = await fetchSessionMessages(projectId, activeSessionId, currentPage + 1, 50);
                    set((state) => ({
                        messages: [...result.messages, ...state.messages],
                        hasMoreMessages: result.hasMore,
                        currentPage: result.currentPage,
                        isLoadingHistory: false,
                    }));
                } catch {
                    set({ isLoadingHistory: false });
                }
            },

            addSessionMessage: (message) => {
                const localMessage: Message = {
                    ...message,
                    id: crypto.randomUUID(),
                    timestamp: Date.now(),
                };
                set((state) => ({ messages: [...state.messages, localMessage] }));

                // Persist to backend session
                const { projectId, activeSessionId } = get();
                if (projectId && activeSessionId) {
                    saveSessionMessage(projectId, activeSessionId, {
                        role: message.role,
                        content: message.content,
                    }).catch((err) => {
                        console.error('[ChatStore] Failed to save message:', err);
                    });
                } else {
                    console.warn('[ChatStore] Cannot save message — no projectId or activeSessionId', { projectId, activeSessionId });
                }
            },

            setPendingUserInput: (pendingUserInput) => set({ pendingUserInput }),
            clearPendingUserInput: () => set({ pendingUserInput: null }),

            abortGeneration: () => {
                get().abortController?.abort();
                set({ isGenerating: false, interimStatus: null });
            },
        }),
        {
            name: 'freecut:ai-chat',
            // Only persist API keys, NOT messages (messages come from backend per project)
            partialize: (state) => ({
                openaiApiKey: state.openaiApiKey,
                pexelsApiKey: state.pexelsApiKey,
                selectedModel: state.selectedModel,
                selectedAgentId: state.selectedAgentId,
            }),
        }
    )
);
