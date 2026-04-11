import { apiClient } from './client';

export interface MessageOut {
  id: string;
  session_id: string;
  role: 'user' | 'assistant';
  content: string;
  created_at: string;
}

export interface SessionOut {
  id: string;
  user_id: string;
  status: 'active' | 'completed';
  summary: string | null;
  started_at: string;
  completed_at: string | null;
  messages: MessageOut[];
}

export interface SessionListItem {
  id: string;
  status: 'active' | 'completed';
  summary: string | null;
  started_at: string;
  completed_at: string | null;
  message_count: number;
}

export interface TurnResponse {
  transcript: string;
  response_text: string;
  audio_base64: string;
  session_id: string;
}

export const createSession = () => apiClient.post<SessionOut>('/sessions');

export const getSessions = () => apiClient.get<SessionListItem[]>('/sessions');

export const getSession = (id: string) =>
  apiClient.get<SessionOut>(`/sessions/${id}`);

export const sendTurn = (sessionId: string, audioBlob: Blob, mimeType: string) => {
  const ext = mimeType.includes('mp4') ? 'mp4' : 'webm';
  const formData = new FormData();
  formData.append('audio', audioBlob, `recording.${ext}`);
  return apiClient.post<TurnResponse>(`/sessions/${sessionId}/turn`, formData);
};

export const completeSession = (id: string) =>
  apiClient.post<SessionOut>(`/sessions/${id}/complete`);

export const deleteSession = (id: string) =>
  apiClient.delete(`/sessions/${id}`);
