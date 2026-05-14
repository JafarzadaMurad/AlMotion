import { ApiClient } from './api-client';
import type { Message } from '@/features/editor/stores/ai-chat-store';

interface BackendChatMessage {
  id: number;
  user_id: number;
  project_id: number;
  session_id: number | null;
  role: 'user' | 'assistant' | 'system';
  content: string;
  tool_calls: unknown[] | null;
  tool_results: unknown[] | null;
  tokens_used: number;
  created_at: string;
  updated_at: string;
}

export interface ChatSession {
  id: number;
  user_id: number;
  project_id: number;
  title: string;
  messages_count: number;
  created_at: string;
  updated_at: string;
}

interface PaginatedMessages {
  data: BackendChatMessage[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

function backendToFrontend(bm: BackendChatMessage): Message {
  return {
    id: String(bm.id),
    role: bm.role,
    content: bm.content,
    timestamp: new Date(bm.created_at).getTime(),
  };
}

// Legacy (backward compat)
export async function fetchChatMessages(projectId: string): Promise<Message[]> {
  const data = await ApiClient.get<BackendChatMessage[]>(
    `/projects/${projectId}/chat`
  );
  return data.map(backendToFrontend);
}

export async function saveChatMessage(
  projectId: string,
  message: { role: string; content: string; tokens_used?: number }
): Promise<Message> {
  const response = await ApiClient.post<BackendChatMessage>(
    `/projects/${projectId}/chat`,
    message
  );
  return backendToFrontend(response);
}

export async function deleteChatMessage(messageId: string): Promise<void> {
  await ApiClient.delete(`/chat/${messageId}`);
}

// Session-based API
export async function fetchSessions(projectId: string): Promise<ChatSession[]> {
  return ApiClient.get<ChatSession[]>(`/projects/${projectId}/sessions`);
}

export async function createSession(projectId: string, title?: string): Promise<ChatSession> {
  return ApiClient.post<ChatSession>(`/projects/${projectId}/sessions`, { title });
}

export async function fetchSessionMessages(
  projectId: string,
  sessionId: number,
  page = 1,
  perPage = 50
): Promise<{ messages: Message[]; hasMore: boolean; currentPage: number }> {
  const data = await ApiClient.get<PaginatedMessages>(
    `/projects/${projectId}/sessions/${sessionId}/messages?page=${page}&per_page=${perPage}`
  );
  return {
    messages: data.data.map(backendToFrontend).reverse(), // API returns latest first, we need oldest first
    hasMore: data.current_page < data.last_page,
    currentPage: data.current_page,
  };
}

export async function saveSessionMessage(
  projectId: string,
  sessionId: number,
  message: { role: string; content: string }
): Promise<Message> {
  const response = await ApiClient.post<BackendChatMessage>(
    `/projects/${projectId}/sessions/${sessionId}/messages`,
    message
  );
  return backendToFrontend(response);
}

export async function deleteSession(projectId: string, sessionId: number): Promise<void> {
  await ApiClient.delete(`/projects/${projectId}/sessions/${sessionId}`);
}

export async function renameSession(projectId: string, sessionId: number, title: string): Promise<ChatSession> {
  return ApiClient.put<ChatSession>(`/projects/${projectId}/sessions/${sessionId}`, { title });
}
